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
