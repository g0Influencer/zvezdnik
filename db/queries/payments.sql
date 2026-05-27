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
