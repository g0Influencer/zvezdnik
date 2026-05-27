package astro

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"zvezdnik/internal/domain"
)

// Client calls an external Swiss Ephemeris-based service (currently the
// Lovable-deployed Yandex Cloud Function at NatalChartURL) to compute natal
// chart data and produce a portrait text in one round-trip.
//
// If NatalChartURL is empty (env not configured), all methods return empty data
// with a warning log, so the onboarding flow proceeds without a real chart.
type Client struct {
	natalChartURL string
	http          *http.Client
}

func NewClient(natalChartURL string) *Client {
	return &Client{
		natalChartURL: natalChartURL,
		http:          &http.Client{Timeout: 60 * time.Second},
	}
}

// planetKeyMap maps lowercase keys from the external service to the TitleCase
// keys used elsewhere in the Go code (chart.go, prompts.go).
var planetKeyMap = map[string]string{
	"sun":       "Sun",
	"moon":      "Moon",
	"mercury":   "Mercury",
	"venus":     "Venus",
	"mars":      "Mars",
	"jupiter":   "Jupiter",
	"saturn":    "Saturn",
	"uranus":    "Uranus",
	"neptune":   "Neptune",
	"pluto":     "Pluto",
	"true_node": "North Node",
}

type natalChartRequest struct {
	BirthDate        string  `json:"birthDate"`
	BirthTime        *string `json:"birthTime"`
	BirthTimeUnknown bool    `json:"birthTimeUnknown"`
	Latitude         float64 `json:"latitude"`
	Longitude        float64 `json:"longitude"`
	TimezoneOffset   float64 `json:"timezoneOffset"`
	HouseSystem      string  `json:"houseSystem,omitempty"`
	Style            string  `json:"style"` // soft | direct (mapped from gentle/blunt)
}

type lovablePlanetDTO struct {
	AbsoluteDegree float64 `json:"absoluteDegree"`
	SignEn         string  `json:"signEn"`
	DegreeInSign   float64 `json:"degreeInSign"`
	House          *int    `json:"house"`
	Retrograde     bool    `json:"retrograde"`
}

type lovableAngleDTO struct {
	Sign         string  `json:"sign"`
	SignEn       string  `json:"signEn"`
	DegreeInSign float64 `json:"degreeInSign"`
}

type lovableHouseDTO struct {
	House          int     `json:"house"`
	SignEn         string  `json:"signEn"`
	DegreeInSign   float64 `json:"degreeInSign"`
	AbsoluteDegree float64 `json:"absoluteDegree"`
}

type lovableChartData struct {
	Planets map[string]lovablePlanetDTO `json:"planets"`
	Angles  *struct {
		Ascendant *lovableAngleDTO `json:"ascendant"`
		MC        *lovableAngleDTO `json:"mc"`
	} `json:"angles"`
	Houses  []lovableHouseDTO `json:"houses"`
	Aspects json.RawMessage   `json:"aspects"`
}

type natalChartResponse struct {
	NatalChartText string           `json:"natalChartText"`
	SummaryForGpt  string           `json:"summaryForGpt"`
	ChartData      lovableChartData `json:"chartData"`
}

func (c *Client) GetNatalChart(ctx context.Context, p domain.BirthParams, style string) (*domain.NatalChartData, error) {
	if c.natalChartURL == "" {
		slog.Warn("astro: NatalChartURL not configured, returning empty chart")
		return emptyNatalChartData(), nil
	}

	birthDate := p.Date.Format("2006-01-02")
	var birthTime *string
	birthTimeUnknown := true
	if p.Time != "" {
		// p.Time is "HH:MM:SS"; the external service expects "HH:MM".
		ht := p.Time
		if len(ht) >= 5 {
			ht = ht[:5]
		}
		birthTime = &ht
		birthTimeUnknown = false
	}

	reqBody := natalChartRequest{
		BirthDate:        birthDate,
		BirthTime:        birthTime,
		BirthTimeUnknown: birthTimeUnknown,
		Latitude:         p.Lat,
		Longitude:        p.Lon,
		TimezoneOffset:   p.Tzone,
		HouseSystem:      "P",
		Style:            mapStyle(style),
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("astro: marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.natalChartURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("astro: create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("astro: http: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("astro: read response: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("astro: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var parsed natalChartResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("astro: parse response: %w", err)
	}

	return convertNatalChart(parsed)
}

func mapStyle(style string) string {
	switch style {
	case domain.StyleGentle:
		return "soft"
	case domain.StyleBlunt:
		return "direct"
	default:
		return "direct"
	}
}

func convertNatalChart(r natalChartResponse) (*domain.NatalChartData, error) {
	planets := make(map[string]map[string]any, len(r.ChartData.Planets))
	for key, p := range r.ChartData.Planets {
		titleKey := planetKeyMap[key]
		if titleKey == "" {
			titleKey = strings.Title(key)
		}
		house := 0
		if p.House != nil {
			house = *p.House
		}
		planets[titleKey] = map[string]any{
			"degree": p.AbsoluteDegree,
			"sign":   p.SignEn,
			"house":  house,
			"retro":  p.Retrograde,
		}
	}
	planetsJSON, err := json.Marshal(planets)
	if err != nil {
		return nil, fmt.Errorf("astro: marshal planets: %w", err)
	}

	cusps := make([]map[string]any, 0, len(r.ChartData.Houses))
	for _, h := range r.ChartData.Houses {
		cusps = append(cusps, map[string]any{
			"house":  h.House,
			"degree": h.AbsoluteDegree,
			"sign":   h.SignEn,
		})
	}
	cuspsJSON, err := json.Marshal(cusps)
	if err != nil {
		return nil, fmt.Errorf("astro: marshal houses: %w", err)
	}

	aspects := r.ChartData.Aspects
	if len(aspects) == 0 {
		aspects = json.RawMessage("[]")
	}

	ascendantSign := ""
	ascendantDegree := 0.0
	if r.ChartData.Angles != nil && r.ChartData.Angles.Ascendant != nil {
		ascendantSign = r.ChartData.Angles.Ascendant.SignEn
		ascendantDegree = r.ChartData.Angles.Ascendant.DegreeInSign
	}

	return &domain.NatalChartData{
		Planets:         planetsJSON,
		Houses:          cuspsJSON,
		Aspects:         aspects,
		AspectPatterns:  json.RawMessage("[]"),
		AscendantSign:   ascendantSign,
		AscendantDegree: ascendantDegree,
		ChartShape:      "",
		SvgDark:         "",
		PortraitText:    r.NatalChartText,
		Summary:         r.SummaryForGpt,
	}, nil
}

func emptyNatalChartData() *domain.NatalChartData {
	return &domain.NatalChartData{
		Planets:        json.RawMessage("{}"),
		Houses:         json.RawMessage("[]"),
		Aspects:        json.RawMessage("[]"),
		AspectPatterns: json.RawMessage("[]"),
	}
}
