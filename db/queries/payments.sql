-- name: CreateSubscription :one
INSERT INTO subscriptions (user_id, type, amount)
VALUES ($1, $2, $3)
RETURNING id;

-- name: GetSubscriptionByID :one
SELECT * FROM subscriptions WHERE id = $1;

-- name: MarkSubscriptionPaid :exec
UPDATE subscriptions
SET status = 'paid', paid_at = NOW(), provider_order_id = $2
WHERE id = $1 AND status <> 'paid';

-- name: RecordCharge :execrows
-- Returns 1 when this InvId is new (apply PRO), 0 when it's a duplicate delivery.
INSERT INTO payment_charges (inv_id, user_id, amount)
VALUES ($1, $2, $3)
ON CONFLICT (inv_id) DO NOTHING;

-- name: RecordConsent :exec
INSERT INTO recurring_consents (user_id, product, offer_url)
VALUES ($1, $2, $3);

-- name: GetActiveRecurringByUser :one
SELECT * FROM recurring_subscriptions WHERE user_id = $1 AND status = 'active';

-- name: CreateRecurringSubscription :exec
INSERT INTO recurring_subscriptions (user_id, mother_inv_id, amount, next_charge_at)
VALUES ($1, $2, $3, $4);

-- name: AdvanceRecurringSubscription :exec
UPDATE recurring_subscriptions
SET next_charge_at = $2, failed_attempts = 0, last_attempt_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: MarkRecurringAttempt :exec
UPDATE recurring_subscriptions
SET last_attempt_at = NOW(), failed_attempts = failed_attempts + 1, updated_at = NOW()
WHERE id = $1;

-- name: CancelRecurringByUser :exec
UPDATE recurring_subscriptions SET status = 'cancelled', updated_at = NOW()
WHERE user_id = $1 AND status = 'active';

-- name: CancelRecurringSubscription :exec
UPDATE recurring_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1;

-- name: ListDueRecurring :many
SELECT * FROM recurring_subscriptions
WHERE status = 'active' AND next_charge_at <= NOW()
  AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '23 hours');
