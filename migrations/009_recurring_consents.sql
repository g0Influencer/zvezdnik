-- Robokassa requires storing the history of users' explicit consent to automatic
-- (recurring) charges. One row per subscription checkout where the user ticked
-- the consent box, capturing what offer terms they agreed to and when.
CREATE TABLE IF NOT EXISTS recurring_consents (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id),
    product      TEXT NOT NULL,
    offer_url    TEXT NOT NULL,
    consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_consents_user ON recurring_consents (user_id, consented_at DESC);
