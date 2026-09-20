package domain

import (
	"time"

	"zvezdnik/internal/db"
)

// User is an alias for the sqlc-generated user struct.
// Re-exported here so the rest of the code keeps using the domain package.
type User = db.User

// TelegramUser is the wire-format payload Telegram sends in initData.
// Not a DB type — kept separate from db.User.
type TelegramUser struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
}

// EffectiveProStatus is what the client should be told, as opposed to the raw
// column. A lapsed subscriber keeps pro_status='active' in the database —
// nothing ever rewrites it — so the raw value would unlock the UI for someone
// the API then refuses. Derive it from the same rule the API gates on.
func EffectiveProStatus(u *User) string {
	if IsPro(u) {
		return ProStatusActive
	}
	if u != nil && (u.ProStatus == ProStatusActive || u.ProStatus == ProStatusExpired) {
		return ProStatusExpired
	}
	return ProStatusFree
}

func IsPro(u *User) bool {
	if u == nil {
		return false
	}
	if u.ProStatus == ProStatusActive {
		if u.SubEndsAt != nil && u.SubEndsAt.After(time.Now()) {
			return true
		}
	}
	if u.TrialEndsAt != nil && u.TrialEndsAt.After(time.Now()) {
		return true
	}
	return false
}
