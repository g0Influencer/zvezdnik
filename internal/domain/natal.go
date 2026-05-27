package domain

import (
	"context"
	"encoding/json"
	"time"

	"zvezdnik/internal/db"
)

// NatalChart is an alias for the sqlc-generated natal_charts row.
type NatalChart = db.NatalChart

type BirthParams struct {
	Date     time.Time
	Time     string // HH:MM:SS
	Place    string
	Lat      float64
	Lon      float64
	Tzone    float64
	FullName string
	Gender   string // male / female
}

type PlanetPosition struct {
	Degree float64 `json:"degree"`
	Sign   string  `json:"sign"`
	House  int     `json:"house"`
	Retro  bool    `json:"retro"`
}

type PlanetaryPositions struct {
	Planets map[string]PlanetPosition `json:"planets"`
}

type HouseCusp struct {
	House  int     `json:"house"`
	Degree float64 `json:"degree"`
	Sign   string  `json:"sign"`
}

type HouseCusps struct {
	Cusps           []HouseCusp `json:"cusps"`
	AscendantSign   string      `json:"ascendant_sign"`
	AscendantDegree float64     `json:"ascendant_degree"`
}

type AspectTable struct {
	Aspects json.RawMessage `json:"aspects"`
}

type AspectPatterns struct {
	Patterns json.RawMessage `json:"patterns"`
}

type ChartShape struct {
	Shape string `json:"shape"`
}

type WheelTheme struct {
	WheelLines      string
	WheelColor      string
	TextColor       string
	OuterBackground string
	WheelBackground string
	ShowSymbol      int
	HouseSystem     string
}

var DarkTheme = WheelTheme{
	WheelLines:      "#444466",
	WheelColor:      "#a0a0ff",
	TextColor:       "#ffffff",
	OuterBackground: "#0d0d1a",
	WheelBackground: "#1a1a2e",
	ShowSymbol:      1,
	HouseSystem:     "P",
}

// NatalChartData bundles all astro-computed fields plus the LLM-generated portrait,
// shaped to match db.UpsertNatalChartParams 1:1.
type NatalChartData struct {
	Planets         json.RawMessage
	Houses          json.RawMessage
	Aspects         json.RawMessage
	AspectPatterns  json.RawMessage
	AscendantSign   string
	AscendantDegree float64
	ChartShape      string
	SvgDark         string
	PortraitText    string // 4-paragraph user-facing portrait (may be empty)
	Summary         string // condensed natal data string for LLM prompts (may be empty)
}

type AstroClient interface {
	GetNatalChart(ctx context.Context, p BirthParams, style string) (*NatalChartData, error)
}
