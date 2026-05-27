package domain

import "time"

// CompatibilityMonthlyCredits — quota of generations a PRO user gets every month.
const CompatibilityMonthlyCredits = 10

// CompatibilityParams is the input for LLM compatibility generation.
type CompatibilityParams struct {
	OtherBirthDate  time.Time
	OtherBirthTime  *string // HH:MM, nil = unknown
	OtherBirthPlace *string // city, nil = unknown
	OtherGender     string  // GenderMale | GenderFemale
	UserStyle       string  // StyleGentle | StyleBlunt
	NatalChartText  string  // pre-rendered user natal description (may be empty)
	IncludeLove     bool
}

// CompatibilityResult mirrors the JSON shape returned by the LLM.
// Persisted verbatim into compatibility_cards.result (JSONB).
type CompatibilityResult struct {
	Title              string                 `json:"title"`
	ShortDescription   string                 `json:"shortDescription"`
	CompatibilityScore int                    `json:"compatibilityScore"`
	CompatibilityLabel string                 `json:"compatibilityLabel"`
	Sections           []CompatibilitySection `json:"sections"`
	Dos                []string               `json:"dos"`
	Donts              []string               `json:"donts"`
}

type CompatibilitySection struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Text  string `json:"text"`
}
