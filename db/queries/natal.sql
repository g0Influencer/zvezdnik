-- name: GetNatalChartByUserID :one
SELECT * FROM natal_charts WHERE user_id = $1;

-- name: UpsertNatalChart :one
INSERT INTO natal_charts (
    user_id, planets, house_cusps,
    ascendant_sign, ascendant_degree,
    aspects, aspect_patterns, chart_shape, svg_dark, portrait_status, summary
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
ON CONFLICT (user_id) DO UPDATE SET
    planets          = EXCLUDED.planets,
    house_cusps      = EXCLUDED.house_cusps,
    ascendant_sign   = EXCLUDED.ascendant_sign,
    ascendant_degree = EXCLUDED.ascendant_degree,
    aspects          = EXCLUDED.aspects,
    aspect_patterns  = EXCLUDED.aspect_patterns,
    chart_shape      = EXCLUDED.chart_shape,
    svg_dark         = EXCLUDED.svg_dark,
    portrait_status  = EXCLUDED.portrait_status,
    summary          = EXCLUDED.summary,
    updated_at       = NOW()
RETURNING *;

-- name: UpdateNatalChartPortrait :exec
UPDATE natal_charts
SET portrait = $2, portrait_status = $3, updated_at = NOW()
WHERE user_id = $1;

-- name: UpdateNatalChartSVG :exec
UPDATE natal_charts
SET svg_dark = $2, updated_at = NOW()
WHERE user_id = $1;
