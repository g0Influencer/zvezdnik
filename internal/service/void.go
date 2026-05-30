package service

import (
	"context"
	"fmt"
	"time"

	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
)

type VoidService struct {
	queries *db.Queries
	llm     domain.LLMClient
}

func NewVoidService(queries *db.Queries, llm domain.LLMClient) *VoidService {
	return &VoidService{queries: queries, llm: llm}
}

type VoidCredits struct {
	Remaining int  `json:"remaining"`
	IsPro     bool `json:"is_pro"`
}

type VoidHistory struct {
	Entries   []db.VoidHistory `json:"entries"`
	Remaining int              `json:"remaining"`
	IsPro     bool             `json:"is_pro"`
}

type VoidAskResult struct {
	Entry     db.VoidHistory `json:"entry"`
	Remaining int            `json:"remaining"`
}

const voidHistoryLimit = 100

func (s *VoidService) Credits(ctx context.Context, user *domain.User) (*VoidCredits, error) {
	remaining, err := s.ensureCredits(ctx, user)
	if err != nil {
		return nil, err
	}
	return &VoidCredits{Remaining: remaining, IsPro: domain.IsPro(user)}, nil
}

func (s *VoidService) History(ctx context.Context, user *domain.User) (*VoidHistory, error) {
	remaining, err := s.ensureCredits(ctx, user)
	if err != nil {
		return nil, err
	}

	entries, err := s.queries.ListVoidHistory(ctx, db.ListVoidHistoryParams{
		UserID: user.ID,
		Limit:  voidHistoryLimit,
	})
	if err != nil {
		return nil, fmt.Errorf("void: list history: %w", err)
	}
	if entries == nil {
		entries = []db.VoidHistory{}
	}

	return &VoidHistory{
		Entries:   entries,
		Remaining: remaining,
		IsPro:     domain.IsPro(user),
	}, nil
}

func (s *VoidService) Ask(ctx context.Context, user *domain.User, question string) (*VoidAskResult, error) {
	// Both free and PRO users can ask, gated only by remaining credits:
	// free users get a one-time VoidFreeCredits, PRO users get VoidMonthlyCredits
	// refreshed monthly (see ensureCredits). Running out yields ErrVoidNoCredits.
	remaining, err := s.ensureCredits(ctx, user)
	if err != nil {
		return nil, err
	}
	if remaining <= 0 {
		return nil, domain.ErrVoidNoCredits
	}

	birthDate := user.BirthDate.Format("2006-01-02")
	birthTime := ""
	if user.BirthTime != nil {
		birthTime = *user.BirthTime
	}

	answer, err := s.llm.AskVoid(ctx, domain.VoidParams{
		Question:   question,
		BirthDate:  birthDate,
		BirthTime:  birthTime,
		BirthPlace: user.BirthPlace,
		Style:      user.Style,
	})
	if err != nil {
		return nil, fmt.Errorf("void: llm: %w", err)
	}

	entry, err := s.queries.InsertVoidEntry(ctx, db.InsertVoidEntryParams{
		UserID:   user.ID,
		Question: question,
		Answer:   answer,
	})
	if err != nil {
		return nil, fmt.Errorf("void: insert entry: %w", err)
	}

	if err := s.queries.DecrementVoidCredits(ctx, user.ID); err != nil {
		return nil, fmt.Errorf("void: decrement credits: %w", err)
	}

	return &VoidAskResult{
		Entry:     entry,
		Remaining: remaining - 1,
	}, nil
}

func (s *VoidService) Delete(ctx context.Context, user *domain.User, entryID int64) error {
	if err := s.queries.DeleteVoidEntry(ctx, db.DeleteVoidEntryParams{
		UserID: user.ID,
		ID:     entryID,
	}); err != nil {
		return fmt.Errorf("void: delete entry: %w", err)
	}
	return nil
}

func (s *VoidService) ensureCredits(ctx context.Context, user *domain.User) (int, error) {
	now := time.Now().UTC()
	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	isPro := domain.IsPro(user)

	existing, err := s.queries.GetVoidCredits(ctx, user.ID)
	if err != nil {
		if !db.IsNotFound(err) {
			return 0, fmt.Errorf("void: get credits: %w", err)
		}
		initial := domain.VoidFreeCredits
		if isPro {
			initial = domain.VoidMonthlyCredits
		}
		if err := s.queries.InsertVoidCredits(ctx, db.InsertVoidCreditsParams{
			UserID:      user.ID,
			Remaining:   int32(initial),
			PeriodStart: currentMonthStart,
		}); err != nil {
			return 0, fmt.Errorf("void: insert credits: %w", err)
		}
		return initial, nil
	}

	if isPro && existing.PeriodStart.Before(currentMonthStart) {
		if err := s.queries.RefreshVoidCredits(ctx, db.RefreshVoidCreditsParams{
			UserID:      user.ID,
			Remaining:   int32(domain.VoidMonthlyCredits),
			PeriodStart: currentMonthStart,
		}); err != nil {
			return 0, fmt.Errorf("void: refresh credits: %w", err)
		}
		return domain.VoidMonthlyCredits, nil
	}

	// Top up if user activated PRO after the credits row was last updated
	// (e.g. they upgraded mid-month and the row was created while still free).
	if isPro && user.ProActivatedAt != nil && existing.UpdatedAt.Before(*user.ProActivatedAt) {
		if err := s.queries.RefreshVoidCredits(ctx, db.RefreshVoidCreditsParams{
			UserID:      user.ID,
			Remaining:   int32(domain.VoidMonthlyCredits),
			PeriodStart: currentMonthStart,
		}); err != nil {
			return 0, fmt.Errorf("void: refresh credits on pro activation: %w", err)
		}
		return domain.VoidMonthlyCredits, nil
	}

	return int(existing.Remaining), nil
}
