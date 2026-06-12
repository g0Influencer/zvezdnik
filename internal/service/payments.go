package service

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"strconv"
	"time"

	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/payments"
)

type PaymentCreateRequest struct {
	Product string `json:"product"`
	Consent bool   `json:"consent"` // user ticked the recurring-charge consent box
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
	"monthly_pro": {displayName: "Звёздник PRO — подписка на месяц", rubles: 199, recurring: true},
}

const (
	recurringProduct     = "monthly_pro"
	recurringPeriod      = 30 * 24 * time.Hour
	maxRecurringAttempts = 3 // daily retries before a failing subscription is cancelled
)

type PaymentsService struct {
	queries   *db.Queries
	rk        *payments.Client
	recurring bool   // gate Recurring=true (Robokassa "Подписки" must be enabled)
	offerURL  string // recorded with each recurring-payment consent
}

func NewPaymentsService(queries *db.Queries, rk *payments.Client, recurring bool, offerURL string) *PaymentsService {
	return &PaymentsService{queries: queries, rk: rk, recurring: recurring, offerURL: offerURL}
}

func (s *PaymentsService) CreatePayment(ctx context.Context, userID int64, req PaymentCreateRequest) (*PaymentCreateResponse, error) {
	spec, ok := productCatalog[req.Product]
	if !ok {
		return nil, fmt.Errorf("payments: unknown product: %s", req.Product)
	}

	// Subscription products require explicit consent to recurring charges; record
	// it for Robokassa compliance and dispute protection before taking payment.
	if spec.recurring {
		if !req.Consent {
			return nil, domain.ErrConsentRequired
		}
		if err := s.queries.RecordConsent(ctx, db.RecordConsentParams{
			UserID: userID, Product: req.Product, OfferUrl: s.offerURL,
		}); err != nil {
			return nil, fmt.Errorf("payments: record consent: %w", err)
		}
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
		Recurring:   spec.recurring && s.recurring,
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

	// First/child payment carries a subscriptions row id as InvId — settle that
	// row and learn the product type to manage the recurring schedule below.
	var productType string
	if sub, err := s.queries.GetSubscriptionByID(ctx, res.InvID); err == nil {
		productType = sub.Type
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

	// For subscription products, (re)establish the recurring schedule: the mother
	// charge creates the record; every charge pushes the next charge date out.
	if spec, ok := productCatalog[productType]; ok && spec.recurring && s.recurring {
		s.recordRecurringCharge(ctx, userID, res.InvID, amountToKopecks(res.OutSum))
	}

	slog.Info("payments: pro extended via webhook", "user_id", userID, "inv_id", res.InvID, "amount", res.OutSum)
	return res.InvID, nil
}

// recordRecurringCharge creates the recurring subscription on the mother charge
// or pushes the next charge date out on subsequent charges. Best-effort.
func (s *PaymentsService) recordRecurringCharge(ctx context.Context, userID, invID int64, amountKopecks int32) {
	next := time.Now().Add(recurringPeriod)
	existing, err := s.queries.GetActiveRecurringByUser(ctx, userID)
	if err == nil {
		if e := s.queries.AdvanceRecurringSubscription(ctx, db.AdvanceRecurringSubscriptionParams{ID: existing.ID, NextChargeAt: next}); e != nil {
			slog.Warn("payments: advance recurring", "user_id", userID, "error", e)
		}
		return
	}
	if !db.IsNotFound(err) {
		slog.Warn("payments: load recurring", "user_id", userID, "error", err)
		return
	}
	// No active subscription yet — this is the mother charge.
	if e := s.queries.CreateRecurringSubscription(ctx, db.CreateRecurringSubscriptionParams{
		UserID: userID, MotherInvID: invID, Amount: amountKopecks, NextChargeAt: next,
	}); e != nil {
		slog.Warn("payments: create recurring", "user_id", userID, "error", e)
	}
}

// ChargeDueRecurring charges every subscription whose next charge date has passed.
// We initiate each child charge ourselves; the outcome returns via the webhook,
// which pushes next_charge_at out on success or leaves it due for the next retry.
func (s *PaymentsService) ChargeDueRecurring(ctx context.Context) error {
	due, err := s.queries.ListDueRecurring(ctx)
	if err != nil {
		return fmt.Errorf("payments: list due recurring: %w", err)
	}
	if len(due) > 0 {
		slog.Info("recurring: due subscriptions", "count", len(due))
	}
	for _, sub := range due {
		if sub.FailedAttempts >= maxRecurringAttempts {
			if e := s.queries.CancelRecurringSubscription(ctx, sub.ID); e != nil {
				slog.Warn("recurring: cancel exhausted", "id", sub.ID, "error", e)
			}
			slog.Info("recurring: cancelled after failed attempts", "id", sub.ID, "user_id", sub.UserID)
			continue
		}
		// Mark the attempt up front so a slow webhook can't cause a double charge.
		if e := s.queries.MarkRecurringAttempt(ctx, sub.ID); e != nil {
			slog.Warn("recurring: mark attempt", "id", sub.ID, "error", e)
			continue
		}
		// Each child charge needs its own InvId — reuse a subscriptions row.
		childInvID, e := s.queries.CreateSubscription(ctx, db.CreateSubscriptionParams{
			UserID: sub.UserID, Type: recurringProduct, Amount: sub.Amount,
		})
		if e != nil {
			slog.Error("recurring: create child subscription", "id", sub.ID, "error", e)
			continue
		}
		if e := s.rk.ChargeRecurring(ctx, childInvID, sub.MotherInvID, float64(sub.Amount)/100, sub.UserID); e != nil {
			slog.Error("recurring: charge failed", "id", sub.ID, "user_id", sub.UserID, "child_inv", childInvID, "error", e)
			continue
		}
		slog.Info("recurring: child charge sent", "id", sub.ID, "user_id", sub.UserID, "child_inv", childInvID)
	}
	return nil
}

// CancelSubscription stops future recurring charges for the user. Access remains
// until the end of the already-paid period (sub_ends_at).
func (s *PaymentsService) CancelSubscription(ctx context.Context, userID int64) error {
	if err := s.queries.CancelRecurringByUser(ctx, userID); err != nil {
		return fmt.Errorf("payments: cancel subscription: %w", err)
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

// amountToKopecks converts Robokassa's OutSum (e.g. "199.00") to integer kopecks.
func amountToKopecks(outSum string) int32 {
	f, err := strconv.ParseFloat(outSum, 64)
	if err != nil {
		return 0
	}
	return int32(f*100 + 0.5)
}
