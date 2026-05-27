-- name: GetDailyContentByDate :one
SELECT * FROM daily_content WHERE date = $1;

-- name: UpsertDailyContent :exec
INSERT INTO daily_content (date, moon_phase, moon_sign, content)
VALUES ($1, $2, $3, $4)
ON CONFLICT (date) DO UPDATE SET
    moon_phase   = EXCLUDED.moon_phase,
    moon_sign    = EXCLUDED.moon_sign,
    content      = EXCLUDED.content,
    generated_at = NOW();
