-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: GetUserByTelegramUserID :one
SELECT * FROM users WHERE telegram_user_id = $1;

-- name: UpsertUser :one
INSERT INTO users (
    telegram_user_id, username, display_name,
    birth_date, birth_time, birth_place,
    birth_lat, birth_lon, birth_tzone, gender,
    style, focus, personalization
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
)
ON CONFLICT (telegram_user_id) DO UPDATE SET
    username        = EXCLUDED.username,
    display_name    = EXCLUDED.display_name,
    birth_date      = EXCLUDED.birth_date,
    birth_time      = EXCLUDED.birth_time,
    birth_place     = EXCLUDED.birth_place,
    birth_lat       = EXCLUDED.birth_lat,
    birth_lon       = EXCLUDED.birth_lon,
    birth_tzone     = EXCLUDED.birth_tzone,
    gender          = EXCLUDED.gender,
    style           = EXCLUDED.style,
    focus           = EXCLUDED.focus,
    personalization = EXCLUDED.personalization,
    updated_at      = NOW()
RETURNING *;

-- name: UpdateUserStyle :exec
UPDATE users SET style = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateUserFocus :exec
UPDATE users SET focus = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateUserDisplayName :exec
UPDATE users SET display_name = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateUserPersonalization :exec
UPDATE users SET personalization = $2, updated_at = NOW() WHERE id = $1;

-- name: UpdateUserPushEnabled :exec
UPDATE users SET push_enabled = $2, updated_at = NOW() WHERE id = $1;

-- name: CancelPro :exec
UPDATE users
SET pro_status = 'free', sub_ends_at = NULL, updated_at = NOW()
WHERE id = $1;

-- name: UpdateUserProStatus :exec
UPDATE users SET pro_status = $2, sub_ends_at = $3, updated_at = NOW() WHERE id = $1;

-- name: ActivatePro :one
UPDATE users
SET pro_status = 'active',
    pro_activated_at = NOW(),
    sub_ends_at = NOW() + INTERVAL '30 days',
    updated_at = NOW()
WHERE id = $1
RETURNING id, telegram_user_id, username, display_name, birth_date, birth_time, birth_place, birth_lat, birth_lon, birth_tzone, gender, style, focus, personalization, pro_status, pro_activated_at, trial_ends_at, sub_ends_at, push_enabled, created_at, updated_at;

-- name: ListPushEnabledUsers :many
SELECT * FROM users WHERE push_enabled = true;
