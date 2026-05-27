-- name: GetVoidCredits :one
SELECT remaining, period_start, updated_at
FROM void_credits
WHERE user_id = $1;

-- name: InsertVoidCredits :exec
INSERT INTO void_credits (user_id, remaining, period_start)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO NOTHING;

-- name: RefreshVoidCredits :exec
UPDATE void_credits
SET remaining = $2, period_start = $3, updated_at = NOW()
WHERE user_id = $1;

-- name: DecrementVoidCredits :exec
UPDATE void_credits
SET remaining = remaining - 1, updated_at = NOW()
WHERE user_id = $1 AND remaining > 0;

-- name: InsertVoidEntry :one
INSERT INTO void_history (user_id, question, answer)
VALUES ($1, $2, $3)
RETURNING id, user_id, question, answer, created_at;

-- name: GetVoidEntry :one
SELECT id, user_id, question, answer, created_at
FROM void_history
WHERE user_id = $1 AND id = $2;

-- name: ListVoidHistory :many
SELECT id, user_id, question, answer, created_at
FROM void_history
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2;

-- name: DeleteVoidEntry :exec
DELETE FROM void_history
WHERE user_id = $1 AND id = $2;
