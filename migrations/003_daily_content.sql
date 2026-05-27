CREATE TABLE IF NOT EXISTS daily_content (
    id              BIGSERIAL PRIMARY KEY,
    date            DATE UNIQUE NOT NULL,
    moon_phase      TEXT NOT NULL,
    moon_sign       TEXT NOT NULL DEFAULT '',
    content         JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL,
    amount      INT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    provider_order_id TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at     TIMESTAMPTZ
);
