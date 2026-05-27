CREATE TABLE IF NOT EXISTS compatibility_cards (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    other_birth_date    DATE NOT NULL,
    other_birth_time    TIME,
    other_birth_place   TEXT,
    other_gender        TEXT NOT NULL CHECK (other_gender IN ('female', 'male')),
    include_love        BOOLEAN NOT NULL DEFAULT false,
    title               TEXT,
    compatibility_score INTEGER,
    compatibility_label TEXT,
    result              JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compatibility_cards_user_created
    ON compatibility_cards (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS compatibility_credits (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    remaining       INTEGER NOT NULL DEFAULT 10,
    period_start    DATE NOT NULL DEFAULT (date_trunc('month', NOW()))::date,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
