CREATE TABLE IF NOT EXISTS natal_charts (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    planets          JSONB NOT NULL DEFAULT '{}'::jsonb,
    house_cusps      JSONB NOT NULL DEFAULT '[]'::jsonb,
    ascendant_sign   TEXT NOT NULL DEFAULT '',
    ascendant_degree FLOAT NOT NULL DEFAULT 0,
    aspects          JSONB NOT NULL DEFAULT '[]'::jsonb,
    aspect_patterns  JSONB NOT NULL DEFAULT '[]'::jsonb,
    chart_shape      TEXT NOT NULL DEFAULT '',
    svg_dark         TEXT NOT NULL DEFAULT '',
    portrait         TEXT NOT NULL DEFAULT '',
    portrait_status  TEXT NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
