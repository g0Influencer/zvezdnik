package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
)

type TodayResponse struct {
	Date             string   `json:"date"`
	Title            string   `json:"title"`
	ShortDescription string   `json:"short_description"`
	FullDescription  string   `json:"full_description"`
	Do               []string `json:"do"`
	Dont             []string `json:"dont"`
	HasLongread      bool     `json:"has_longread"`
}

type TodayService struct {
	queries *db.Queries
	astro   domain.AstroClient
	llm     domain.LLMClient
	rdb     *redis.Client
}

func NewTodayService(queries *db.Queries, astro domain.AstroClient, llm domain.LLMClient, rdb *redis.Client) *TodayService {
	return &TodayService{queries: queries, astro: astro, llm: llm, rdb: rdb}
}

var weekdayRu = map[time.Weekday]string{
	time.Monday:    "Понедельник",
	time.Tuesday:   "Вторник",
	time.Wednesday: "Среда",
	time.Thursday:  "Четверг",
	time.Friday:    "Пятница",
	time.Saturday:  "Суббота",
	time.Sunday:    "Воскресенье",
}

func (s *TodayService) GetToday(ctx context.Context, user *domain.User) (*TodayResponse, error) {
	now := time.Now()
	dateStr := now.Format("2006-01-02")
	cacheKey := fmt.Sprintf("daily:%d:%s", user.ID, dateStr)

	cached, err := s.rdb.Get(ctx, cacheKey).Result()
	if err == nil {
		var resp TodayResponse
		if json.Unmarshal([]byte(cached), &resp) == nil {
			return &resp, nil
		}
	}

	chart, err := s.queries.GetNatalChartByUserID(ctx, user.ID)
	if err != nil && !db.IsNotFound(err) {
		return nil, fmt.Errorf("today: get natal chart: %w", err)
	}

	var planets map[string]domain.PlanetPosition
	_ = json.Unmarshal(chart.Planets, &planets)

	slot, err := s.llm.GenerateDailyContent(ctx, domain.DailyContentParams{
		Date:            now,
		Weekday:         weekdayRu[now.Weekday()],
		Tone:            user.Style,
		ToneRu:          toneToRu(user.Style),
		Planets:         planets,
		AscendantSign:   chart.AscendantSign,
		ChartShape:      chart.ChartShape,
		Personalization: json.RawMessage(user.Personalization),
	})
	if err != nil {
		return nil, fmt.Errorf("today: generate daily content: %w", err)
	}

	resp := &TodayResponse{
		Date:             dateStr,
		Title:            slot.Title,
		ShortDescription: slot.ShortDescription,
		FullDescription:  slot.FullDescription,
		Do:               slot.Do,
		Dont:             slot.Dont,
		HasLongread:      domain.IsPro(user),
	}
	s.cacheResponse(ctx, cacheKey, resp)
	return resp, nil
}

func (s *TodayService) cacheResponse(ctx context.Context, key string, resp *TodayResponse) {
	data, _ := json.Marshal(resp)
	s.rdb.Set(ctx, key, string(data), 25*time.Hour)
}

func toneToRu(t string) string {
	m := map[string]string{
		"gentle": "мягкий и поддерживающий", "blunt": "прямой и без фильтров",
	}
	if v, ok := m[t]; ok {
		return v
	}
	return t
}
