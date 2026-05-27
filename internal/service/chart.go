package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/llm"
)

type PlanetInfo struct {
	Name   string `json:"name"`
	NameEn string `json:"name_en"`
	Sign   string `json:"sign"`
	SignRu string `json:"sign_ru"`
	House  int    `json:"house"`
	Degree string `json:"degree"`
	Retro  bool   `json:"retro"`
}

type ChartResponse struct {
	SVG            string          `json:"svg"`
	Ascendant      string          `json:"ascendant"`
	ChartShape     string          `json:"chart_shape"`
	ChartShapeRu   string          `json:"chart_shape_ru"`
	Planets        []PlanetInfo    `json:"planets"`
	AspectPatterns json.RawMessage `json:"aspect_patterns"`
	Portrait       string          `json:"portrait"`
	PortraitStatus string          `json:"portrait_status"`
}

type ChartService struct {
	queries *db.Queries
}

func NewChartService(queries *db.Queries) *ChartService {
	return &ChartService{queries: queries}
}

var planetNames = map[string]string{
	"Sun": "Солнце", "Moon": "Луна", "Mercury": "Меркурий",
	"Venus": "Венера", "Mars": "Марс", "Jupiter": "Юпитер",
	"Saturn": "Сатурн", "Uranus": "Уран", "Neptune": "Нептун",
	"Pluto": "Плутон", "North Node": "Сев. Узел", "South Node": "Юж. Узел",
	"Chiron": "Хирон", "Lilith": "Лилит",
}

var planetOrder = map[string]int{
	"Sun": 1, "Moon": 2, "Mercury": 3, "Venus": 4, "Mars": 5,
	"Jupiter": 6, "Saturn": 7, "Uranus": 8, "Neptune": 9, "Pluto": 10,
	"North Node": 11, "South Node": 12, "Chiron": 13, "Lilith": 14,
}

var skipPlanets = map[string]bool{
	"Ascendant": true, "MC": true,
}

func (s *ChartService) GetChart(ctx context.Context, userID int64) (*ChartResponse, error) {
	nc, err := s.queries.GetNatalChartByUserID(ctx, userID)
	if err != nil {
		if db.IsNotFound(err) {
			return nil, domain.ErrNatalChartNotFound
		}
		return nil, fmt.Errorf("chart: %w", err)
	}

	var planets map[string]domain.PlanetPosition
	_ = json.Unmarshal(nc.Planets, &planets)

	var planetInfos []PlanetInfo
	for key, p := range planets {
		if skipPlanets[key] {
			continue
		}
		name := key
		if ruName, ok := planetNames[key]; ok {
			name = ruName
		}
		deg := int(p.Degree) % 30
		min := int((p.Degree - float64(int(p.Degree))) * 60)
		planetInfos = append(planetInfos, PlanetInfo{
			Name:   name,
			NameEn: key,
			Sign:   p.Sign,
			SignRu: llm.SignToRu(p.Sign),
			House:  p.House,
			Degree: fmt.Sprintf("%d°%02d'", deg, min),
			Retro:  p.Retro,
		})
	}
	sort.Slice(planetInfos, func(i, j int) bool {
		oi := planetOrder[planetInfos[i].NameEn]
		oj := planetOrder[planetInfos[j].NameEn]
		if oi == 0 {
			oi = 100
		}
		if oj == 0 {
			oj = 100
		}
		if oi != oj {
			return oi < oj
		}
		return strings.Compare(planetInfos[i].NameEn, planetInfos[j].NameEn) < 0
	})

	return &ChartResponse{
		SVG:            nc.SvgDark,
		Ascendant:      llm.SignToRu(nc.AscendantSign),
		ChartShape:     nc.ChartShape,
		ChartShapeRu:   llm.ShapeToRu(nc.ChartShape),
		Planets:        planetInfos,
		AspectPatterns: json.RawMessage(nc.AspectPatterns),
		Portrait:       nc.Portrait,
		PortraitStatus: nc.PortraitStatus,
	}, nil
}
