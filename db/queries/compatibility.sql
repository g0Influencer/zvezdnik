-- name: GetCompatibilityCredits :one
SELECT remaining, period_start, updated_at
FROM compatibility_credits
WHERE user_id = $1;

-- name: InsertCompatibilityCredits :exec
INSERT INTO compatibility_credits (user_id, remaining, period_start)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO NOTHING;

-- name: RefreshCompatibilityCredits :exec
UPDATE compatibility_credits
SET remaining = $2, period_start = $3, updated_at = NOW()
WHERE user_id = $1;

-- name: DecrementCompatibilityCredits :exec
UPDATE compatibility_credits
SET remaining = remaining - 1, updated_at = NOW()
WHERE user_id = $1 AND remaining > 0;

-- name: ListCompatibilityCards :many
SELECT id, other_birth_date, other_birth_time, other_birth_place,
       other_gender, include_love, title, compatibility_score,
       compatibility_label, created_at
FROM compatibility_cards
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: GetCompatibilityCard :one
SELECT * FROM compatibility_cards
WHERE user_id = $1 AND id = $2;

-- name: InsertCompatibilityCard :one
INSERT INTO compatibility_cards (
    user_id, other_birth_date, other_birth_time, other_birth_place,
    other_gender, include_love, title, compatibility_score,
    compatibility_label, result
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;
