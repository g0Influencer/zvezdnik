package domain

// VoidMonthlyCredits — monthly quota of questions for PRO users.
const VoidMonthlyCredits = 20

// VoidFreeCredits — one-time quota for free users (no monthly refresh).
const VoidFreeCredits = 1

// VoidParams is the input for LLM void/oracle generation.
type VoidParams struct {
	Question   string
	BirthDate  string // YYYY-MM-DD, "" if unset
	BirthTime  string // HH:MM, "" if unset
	BirthPlace string // city, "" if unset
	Style      string // StyleGentle | StyleBlunt
}
