package domain

import (
	"context"
	"encoding/json"
	"time"

	"zvezdnik/internal/db"
)

// DailyContent is an alias for the sqlc-generated daily_content row.
type DailyContent = db.DailyContent

type DailySlot struct {
	Title            string   `json:"title"`
	ShortDescription string   `json:"short_description"`
	FullDescription  string   `json:"full_description"`
	Do               []string `json:"do"`
	Dont             []string `json:"dont"`
	PushTitle        string   `json:"push_title"`
}

type DailyContentParams struct {
	Date            time.Time
	Weekday         string
	Tone            string
	ToneRu          string
	Planets         map[string]PlanetPosition
	AscendantSign   string
	ChartShape      string
	Personalization json.RawMessage
}

type LLMClient interface {
	GeneratePortrait(ctx context.Context, chart *NatalChart, tone string) (string, error)
	GenerateDailyContent(ctx context.Context, p DailyContentParams) (*DailySlot, error)
	AskVoid(ctx context.Context, p VoidParams) (string, error)
	GenerateCompatibility(ctx context.Context, p CompatibilityParams) (*CompatibilityResult, error)
}
