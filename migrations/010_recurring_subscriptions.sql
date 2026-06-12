-- API-recurring (рекуррентные платежи): we drive the billing ourselves. One row
-- per user's active subscription, tracking the "mother" InvId used as
-- PreviousInvoiceID for child charges, the next charge date, and dunning state.
CREATE TABLE IF NOT EXISTS recurring_subscriptions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    mother_inv_id   BIGINT NOT NULL,             -- first payment InvId; PreviousInvoiceID for children
    amount          INT NOT NULL,                -- kopecks
    status          TEXT NOT NULL DEFAULT 'active', -- active | cancelled
    next_charge_at  TIMESTAMPTZ NOT NULL,
    last_attempt_at TIMESTAMPTZ,
    failed_attempts INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one active subscription per user.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_recurring_per_user
    ON recurring_subscriptions (user_id) WHERE status = 'active';
