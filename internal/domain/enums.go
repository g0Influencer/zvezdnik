package domain

// Style values for users.style.
const (
	StyleGentle = "gentle"
	StyleBlunt  = "blunt"
)

// ProStatus values for users.pro_status.
const (
	ProStatusFree    = "free"
	ProStatusActive  = "active"
	ProStatusExpired = "expired"
)

// PortraitStatus values for natal_charts.portrait_status.
const (
	PortraitStatusPending = "pending"
	PortraitStatusDone    = "done"
	PortraitStatusError   = "error"
)

// ChatRole values for chat_history.role.
const (
	ChatRoleUser      = "user"
	ChatRoleAssistant = "assistant"
)

// Gender values for users.gender and compatibility_cards.other_gender.
const (
	GenderMale   = "male"
	GenderFemale = "female"
)
