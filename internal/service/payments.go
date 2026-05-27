package service

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"

	"zvezdnik/internal/db"
	"zvezdnik/internal/payments"
)

type PaymentCreateRequest struct {
	Product string `json:"product"`
}

type PaymentCreateResponse struct {
	PaymentURL string `json:"payment_url"`
	PaymentID  string `json:"payment_id"`
}

type productSpec struct {
	displayName string
	rubles      int
	kopecks     int32
}

var productCatalog = map[string]productSpec{
	"monthly_pro": {displayName: "Звёздник PRO — 1 месяц", rubles: 299, kopecks: 29900},
	"longread":    {displayName: "Лонгрид", rubles: 99, kopecks: 9900},
}

type PaymentsService struct {
	queries         *db.Queries
	shopURL         string
	secretKey       string
	notificationURL string
}

func NewPaymentsService(queries *db.Queries, shopURL, secretKey, notificationURL string) *PaymentsService {
	return &PaymentsService{
		queries:         queries,
		shopURL:         shopURL,
		secretKey:       secretKey,
		notificationURL: notificationURL,
	}
}

func (s *PaymentsService) CreatePayment(ctx context.Context, userID int64, req PaymentCreateRequest) (*PaymentCreateResponse, error) {
	spec, ok := productCatalog[req.Product]
	if !ok {
		return nil, fmt.Errorf("payments: unknown product: %s", req.Product)
	}

	subID, err := s.queries.CreateSubscription(ctx, db.CreateSubscriptionParams{
		UserID: userID, Type: req.Product, Amount: spec.kopecks,
	})
	if err != nil {
		return nil, fmt.Errorf("payments: create subscription: %w", err)
	}

	orderID := strconv.FormatInt(subID, 10)
	url, err := payments.BuildPaymentURL(s.shopURL, s.secretKey, payments.PaymentRequest{
		OrderID:         orderID,
		OrderNum:        orderID,
		CustomerExtra:   fmt.Sprintf("user_id=%d", userID),
		NotificationURL: s.notificationURL,
		Products: []payments.Product{
			{Name: spec.displayName, Price: strconv.Itoa(spec.rubles), Quantity: 1, SKU: req.Product},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("payments: build url: %w", err)
	}
	return &PaymentCreateResponse{PaymentURL: url, PaymentID: orderID}, nil
}

// HandleWebhook verifies the Prodamus signature, marks the subscription paid
// and activates PRO for monthly_pro orders. Idempotent on re-delivery.
func (s *PaymentsService) HandleWebhook(ctx context.Context, body []byte) error {
	vals, err := payments.VerifyWebhook(s.secretKey, body)
	if err != nil {
		return fmt.Errorf("payments: verify webhook: %w", err)
	}

	status := vals.Get("payment_status")
	if status != "success" {
		slog.Info("payments: webhook ignored non-success status", "status", status, "order_id", vals.Get("order_id"))
		return nil
	}

	subID, err := strconv.ParseInt(vals.Get("order_id"), 10, 64)
	if err != nil {
		return fmt.Errorf("payments: invalid order_id %q: %w", vals.Get("order_id"), err)
	}
	sub, err := s.queries.GetSubscriptionByID(ctx, subID)
	if err != nil {
		return fmt.Errorf("payments: load subscription: %w", err)
	}

	providerRef := vals.Get("order_num")
	if providerRef == "" {
		providerRef = vals.Get("order_id")
	}
	if err := s.queries.MarkSubscriptionPaid(ctx, db.MarkSubscriptionPaidParams{
		ID:              sub.ID,
		ProviderOrderID: optionalStr(providerRef),
	}); err != nil {
		return fmt.Errorf("payments: mark paid: %w", err)
	}

	if sub.Type == "monthly_pro" {
		if _, err := s.queries.ActivatePro(ctx, sub.UserID); err != nil {
			return fmt.Errorf("payments: activate pro: %w", err)
		}
		slog.Info("payments: pro activated via webhook", "user_id", sub.UserID, "subscription_id", sub.ID)
	}
	return nil
}

// ActivatePro is exported for the dev-only "Включить PRO" shortcut on Profile.
func (s *PaymentsService) ActivatePro(ctx context.Context, userID int64) error {
	if _, err := s.queries.ActivatePro(ctx, userID); err != nil {
		return fmt.Errorf("payments: activate pro: %w", err)
	}
	return nil
}

func optionalStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
