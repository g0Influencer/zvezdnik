package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
)

type CompatibilityService struct {
	queries *db.Queries
	llm     domain.LLMClient
}

func NewCompatibilityService(queries *db.Queries, llm domain.LLMClient) *CompatibilityService {
	return &CompatibilityService{queries: queries, llm: llm}
}

type GenerateCompatibilityInput struct {
	OtherBirthDate  time.Time
	OtherBirthTime  *string // HH:MM, nil = unknown
	OtherBirthPlace *string // city, nil = unknown
	OtherGender     string  // GenderMale | GenderFemale
	IncludeLove     bool
}

type CompatibilityCredits struct {
	Remaining int  `json:"remaining"`
	IsPro     bool `json:"is_pro"`
}

type CompatibilityHistory struct {
	Cards     []db.ListCompatibilityCardsRow `json:"cards"`
	Remaining int                            `json:"remaining"`
	IsPro     bool                           `json:"is_pro"`
}

type CompatibilityGenerateResult struct {
	Card      db.CompatibilityCard `json:"card"`
	Remaining int                  `json:"remaining"`
}

const compatibilityHistoryLimit = 100

func (s *CompatibilityService) Credits(ctx context.Context, user *domain.User) (*CompatibilityCredits, error) {
	remaining, err := s.ensureCredits(ctx, user)
	if err != nil {
		return nil, err
	}
	return &CompatibilityCredits{Remaining: remaining, IsPro: domain.IsPro(user)}, nil
}

func (s *CompatibilityService) History(ctx context.Context, user *domain.User) (*CompatibilityHistory, error) {
	remaining, err := s.ensureCredits(ctx, user)
	if err != nil {
		return nil, err
	}

	cards, err := s.queries.ListCompatibilityCards(ctx, db.ListCompatibilityCardsParams{
		UserID: user.ID,
		Limit:  compatibilityHistoryLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("compatibility: list cards: %w", err)
	}
	if cards == nil {
		cards = []db.ListCompatibilityCardsRow{}
	}

	return &CompatibilityHistory{
		Cards:     cards,
		Remaining: remaining,
		IsPro:     domain.IsPro(user),
	}, nil
}

func (s *CompatibilityService) Get(ctx context.Context, user *domain.User, cardID int64) (*db.CompatibilityCard, error) {
	card, err := s.queries.GetCompatibilityCard(ctx, db.GetCompatibilityCardParams{
		UserID: user.ID,
		ID:     cardID,
	})
	if err != nil {
		if db.IsNotFound(err) {
			return nil, domain.ErrCompatibilityCardNotFound
		}
		return nil, fmt.Errorf("compatibility: get card: %w", err)
	}
	return &card, nil
}

func (s *CompatibilityService) Generate(ctx context.Context, user *domain.User, in GenerateCompatibilityInput) (*CompatibilityGenerateResult, error) {
	if !domain.IsPro(user) {
		return nil, domain.ErrProRequired
	}

	remaining, err := s.ensureCredits(ctx, user)
	if err != nil {
		return nil, err
	}
	if remaining <= 0 {
		return nil, domain.ErrCompatibilityNoCredits
	}

	natalSummary := ""
	if chart, err := s.queries.GetNatalChartByUserID(ctx, user.ID); err == nil {
		natalSummary = chart.Summary
	}

	result, err := s.llm.GenerateCompatibility(ctx, domain.CompatibilityParams{
		OtherBirthDate:  in.OtherBirthDate,
		OtherBirthTime:  in.OtherBirthTime,
		OtherBirthPlace: in.OtherBirthPlace,
		OtherGender:     in.OtherGender,
		UserStyle:       user.Style,
		NatalChartText:  natalSummary,
		IncludeLove:     in.IncludeLove,
	})
	if err != nil {
		return nil, fmt.Errorf("compatibility: llm: %w", err)
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("compatibility: marshal result: %w", err)
	}

	score := int32(result.CompatibilityScore)
	card, err := s.queries.InsertCompatibilityCard(ctx, db.InsertCompatibilityCardParams{
		UserID:             user.ID,
		OtherBirthDate:     in.OtherBirthDate,
		OtherBirthTime:     in.OtherBirthTime,
		OtherBirthPlace:    in.OtherBirthPlace,
		OtherGender:        in.OtherGender,
		IncludeLove:        in.IncludeLove,
		Title:              &result.Title,
		CompatibilityScore: &score,
		CompatibilityLabel: &result.CompatibilityLabel,
		Result:             resultBytes,
	})
	if err != nil {
		return nil, fmt.Errorf("compatibility: insert card: %w", err)
	}

	if err := s.queries.DecrementCompatibilityCredits(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("compatibility: decrement credits: %w", err)
	}

	_ = result // result already persisted into card.Result as JSONB
	return &CompatibilityGenerateResult{
		Card:      card,
		Remaining: remaining - 1,
	}, nil
}

// ensureCredits returns the current remaining credit count for the user.
// Lazily creates the credits row, and refreshes it to the monthly quota when
// a new month starts (PRO only).
func (s *CompatibilityService) ensureCredits(ctx context.Context, user *domain.User) (int, error) {
	now := time.Now().UTC()
	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	isPro := domain.IsPro(user)

	existing, err := s.queries.GetCompatibilityCredits(ctx, user.ID)
	if err != nil {
		if !db.IsNotFound(err) {
			return 0, fmt.Errorf("compatibility: get credits: %w", err)
		}
		initial := 0
		if isPro {
			initial = domain.CompatibilityMonthlyCredits
		}
		if err := s.queries.InsertCompatibilityCredits(ctx, db.InsertCompatibilityCreditsParams{
			UserID:      user.ID,
			Remaining:   int32(initial),
			PeriodStart: currentMonthStart,
		}); err != nil {
			return 0, fmt.Errorf("compatibility: insert credits: %w", err)
		}
		return initial, nil
	}

	if isPro && existing.PeriodStart.Before(currentMonthStart) {
		if err := s.queries.RefreshCompatibilityCredits(ctx, db.RefreshCompatibilityCreditsParams{
			UserID:      user.ID,
			Remaining:   int32(domain.CompatibilityMonthlyCredits),
			PeriodStart: currentMonthStart,
		}); err != nil {
			return 0, fmt.Errorf("compatibility: refresh credits: %w", err)
		}
		return domain.CompatibilityMonthlyCredits, nil
	}

	if isPro && user.ProActivatedAt != nil && existing.UpdatedAt.Before(*user.ProActivatedAt) {
		if err := s.queries.RefreshCompatibilityCredits(ctx, db.RefreshCompatibilityCreditsParams{
			UserID:      user.ID,
			Remaining:   int32(domain.CompatibilityMonthlyCredits),
			PeriodStart: currentMonthStart,
		}); err != nil {
			return 0, fmt.Errorf("compatibility: refresh credits on pro activation: %w", err)
		}
		return domain.CompatibilityMonthlyCredits, nil
	}

	return int(existing.Remaining), nil
}
