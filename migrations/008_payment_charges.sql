-- One row per Robokassa ResultURL notification, keyed by the Robokassa InvId,
-- so repeated webhook deliveries (and the platform's retries) stay idempotent:
-- a charge is applied to PRO only on first insert. Covers both the first
-- subscription payment and every automatic recurring charge.
CREATE TABLE IF NOT EXISTS payment_charges (
    inv_id     BIGINT PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id),
    amount     INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
