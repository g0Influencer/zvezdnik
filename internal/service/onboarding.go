package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"zvezdnik/internal/astro"
	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
)

type OnboardingRequest struct {
	BirthDate       string          `json:"birth_date"`
	BirthTime       string          `json:"birth_time"`
	BirthPlace      string          `json:"birth_place"`
	BirthLat        float64         `json:"birth_lat"`
	BirthLon        float64         `json:"birth_lon"`
	Gender          string          `json:"gender"`
	Style           string          `json:"style"`
	Focus           string          `json:"focus"`
	Personalization json.RawMessage `json:"personalization,omitempty"`
}

type OnboardingResult struct {
	Status        string `json:"status"`
	NatalReady    bool   `json:"natal_ready"`
	PortraitReady bool   `json:"portrait_ready"`
}

type OnboardingService struct {
	queries *db.Queries
	astro   domain.AstroClient
	llm     domain.LLMClient
}

func NewOnboardingService(queries *db.Queries, astro domain.AstroClient, llm domain.LLMClient) *OnboardingService {
	return &OnboardingService{queries: queries, astro: astro, llm: llm}
}

func (s *OnboardingService) Complete(ctx context.Context, tgUser domain.TelegramUser, req OnboardingRequest) (*OnboardingResult, error) {
	birthDate, err := time.Parse("2006-01-02", req.BirthDate)
	if err != nil {
		return nil, fmt.Errorf("onboarding: parse birth date: %w", err)
	}

	birthTimeFull := ""
	if req.BirthTime != "" {
		birthTimeFull = req.BirthTime + ":00"
	}

	var birthTimePtr *string
	if req.BirthTime != "" {
		bt := req.BirthTime
		birthTimePtr = &bt
	}

	var usernamePtr *string
	if tgUser.Username != "" {
		un := tgUser.Username
		usernamePtr = &un
	}
	var displayNamePtr *string
	if tgUser.FirstName != "" {
		dn := tgUser.FirstName
		displayNamePtr = &dn
	}
	var genderPtr *string
	if req.Gender == domain.GenderMale || req.Gender == domain.GenderFemale {
		g := req.Gender
		genderPtr = &g
	}

	personalization := []byte(req.Personalization)
	if len(personalization) == 0 {
		personalization = []byte("{}")
	}

	// Resolve coordinates: prefer values from frontend, fall back to lookup by
	// city name. If still unknown, swiss-eph-data degrades gracefully (planets
	// work, houses don't).
	lat, lon := req.BirthLat, req.BirthLon
	if lat == 0 && lon == 0 {
		if l, o, ok := astro.LookupCity(req.BirthPlace); ok {
			lat, lon = l, o
			slog.Info("onboarding: resolved city to coords", "place", req.BirthPlace, "lat", lat, "lon", lon)
		} else {
			slog.Warn("onboarding: unknown city, houses won't be calculated", "place", req.BirthPlace)
		}
	}

	tzOffset, _ := astro.GetHistoricalTimezone(lat, lon, birthDate, req.BirthPlace)

	upserted, err := s.queries.UpsertUser(ctx, db.UpsertUserParams{
		TelegramUserID:  tgUser.ID,
		Username:        usernamePtr,
		DisplayName:     displayNamePtr,
		BirthDate:       birthDate,
		BirthTime:       birthTimePtr,
		BirthPlace:      req.BirthPlace,
		BirthLat:        lat,
		BirthLon:        lon,
		BirthTzone:      tzOffset,
		Gender:          genderPtr,
		Style:           req.Style,
		Focus:           req.Focus,
		Personalization: personalization,
	})
	if err != nil {
		return nil, fmt.Errorf("onboarding: upsert user: %w", err)
	}
	userID := upserted.ID

	bp := domain.BirthParams{
		Date:     birthDate,
		Time:     birthTimeFull,
		Place:    req.BirthPlace,
		Lat:      lat,
		Lon:      lon,
		Tzone:    tzOffset,
		FullName: tgUser.FirstName,
		Gender:   firstNonEmpty(req.Gender, domain.GenderMale),
	}

	chart, err := s.astro.GetNatalChart(ctx, bp, req.Style)
	if err != nil {
		slog.Warn("onboarding: get natal chart failed, persisting empty", "error", err)
		chart = emptyChart()
	}

	portraitStatus := domain.PortraitStatusPending
	if chart.PortraitText != "" {
		portraitStatus = domain.PortraitStatusDone
	}

	if _, err := s.queries.UpsertNatalChart(ctx, db.UpsertNatalChartParams{
		UserID:          userID,
		Planets:         chart.Planets,
		HouseCusps:      chart.Houses,
		AscendantSign:   chart.AscendantSign,
		AscendantDegree: chart.AscendantDegree,
		Aspects:         chart.Aspects,
		AspectPatterns:  chart.AspectPatterns,
		ChartShape:      chart.ChartShape,
		SvgDark:         chart.SvgDark,
		PortraitStatus:  portraitStatus,
		Summary:         chart.Summary,
	}); err != nil {
		return nil, fmt.Errorf("onboarding: save natal chart: %w", err)
	}

	if chart.PortraitText != "" {
		if err := s.queries.UpdateNatalChartPortrait(ctx, db.UpdateNatalChartPortraitParams{
			UserID:         userID,
			Portrait:       chart.PortraitText,
			PortraitStatus: domain.PortraitStatusDone,
		}); err != nil {
			slog.Error("onboarding: save portrait failed", "user_id", userID, "error", err)
		}
	}

	return &OnboardingResult{
		Status:        "ok",
		NatalReady:    true,
		PortraitReady: chart.PortraitText != "",
	}, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func emptyChart() *domain.NatalChartData {
	return &domain.NatalChartData{
		Planets:        json.RawMessage("{}"),
		Houses:         json.RawMessage("[]"),
		Aspects:        json.RawMessage("[]"),
		AspectPatterns: json.RawMessage("[]"),
	}
}
