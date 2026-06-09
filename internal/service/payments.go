package service

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
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
	rubles      float64
	recurring   bool // first payment enrolls the card into a Robokassa subscription
}

var productCatalog = map[string]productSpec{
	"monthly_pro": {displayName: "Звёздник PRO — подписка на месяц", rubles: 299, recurring: true},
}

type PaymentsService struct {
	queries *db.Queries
	rk      *payments.Client
}

func NewPaymentsService(queries *db.Queries, rk *payments.Client) *PaymentsService {
	return &PaymentsService{queries: queries, rk: rk}
}

func (s *PaymentsService) CreatePayment(ctx context.Context, userID int64, req PaymentCreateRequest) (*PaymentCreateResponse, error) {
	spec, ok := productCatalog[req.Product]
	if !ok {
		return nil, fmt.Errorf("payments: unknown product: %s", req.Product)
	}

	subID, err := s.queries.CreateSubscription(ctx, db.CreateSubscriptionParams{
		UserID: userID, Type: req.Product, Amount: int32(spec.rubles * 100),
	})
	if err != nil {
		return nil, fmt.Errorf("payments: create subscription: %w", err)
	}

	payURL, err := s.rk.PaymentURL(payments.Invoice{
		InvID:       subID,
		AmountRub:   spec.rubles,
		Description: spec.displayName,
		UserID:      userID,
		Recurring:   spec.recurring,
		Items:       []payments.ReceiptItem{{Name: spec.displayName, Quantity: 1, SumRub: spec.rubles}},
	})
	if err != nil {
		return nil, fmt.Errorf("payments: build url: %w", err)
	}
	return &PaymentCreateResponse{PaymentURL: payURL, PaymentID: strconv.FormatInt(subID, 10)}, nil
}

// HandleWebhook verifies a Robokassa ResultURL notification, extends PRO and
// returns the InvId so the caller can answer "OK<InvId>". Idempotent per InvId,
// so platform retries and recurring re-deliveries apply the charge only once.
func (s *PaymentsService) HandleWebhook(ctx context.Context, values url.Values) (int64, error) {
	res, err := s.rk.VerifyResult(values)
	if err != nil {
		return 0, fmt.Errorf("payments: verify webhook: %w", err)
	}

	// Resolve the user. Shp_userId rides along on the first payment and every
	// recurring charge; fall back to the subscription row keyed by the first
	// payment's InvId.
	userID := res.UserID
	if userID == 0 {
		if sub, err := s.queries.GetSubscriptionByID(ctx, res.InvID); err == nil {
			userID = sub.UserID
		}
	}
	if userID == 0 {
		return res.InvID, fmt.Errorf("payments: cannot resolve user for InvId %d", res.InvID)
	}

	// Idempotency gate: first delivery of this InvId returns 1, duplicates 0.
	inserted, err := s.queries.RecordCharge(ctx, db.RecordChargeParams{
		InvID: res.InvID, UserID: userID, Amount: amountToKopecks(res.OutSum),
	})
	if err != nil {
		return res.InvID, fmt.Errorf("payments: record charge: %w", err)
	}
	if inserted == 0 {
		slog.Info("payments: duplicate webhook ignored", "inv_id", res.InvID, "user_id", userID)
		return res.InvID, nil
	}

	// First payment carries our subscription id as InvId — settle that row.
	if sub, err := s.queries.GetSubscriptionByID(ctx, res.InvID); err == nil {
		ref := strconv.FormatInt(res.InvID, 10)
		if err := s.queries.MarkSubscriptionPaid(ctx, db.MarkSubscriptionPaidParams{
			ID: sub.ID, ProviderOrderID: &ref,
		}); err != nil {
			slog.Warn("payments: mark subscription paid", "subscription_id", sub.ID, "error", err)
		}
	}

	if _, err := s.queries.ActivatePro(ctx, userID); err != nil {
		return res.InvID, fmt.Errorf("payments: activate pro: %w", err)
	}
	slog.Info("payments: pro extended via webhook", "user_id", userID, "inv_id", res.InvID, "amount", res.OutSum)
	return res.InvID, nil
}

// ActivatePro is exported for the dev-only "Включить PRO" shortcut on Profile.
func (s *PaymentsService) ActivatePro(ctx context.Context, userID int64) error {
	if _, err := s.queries.ActivatePro(ctx, userID); err != nil {
		return fmt.Errorf("payments: activate pro: %w", err)
	}
	return nil
}

// amountToKopecks converts Robokassa's OutSum (e.g. "299.00") to integer kopecks.
func amountToKopecks(outSum string) int32 {
	f, err := strconv.ParseFloat(outSum, 64)
	if err != nil {
		return 0
	}
	return int32(f*100 + 0.5)
}
