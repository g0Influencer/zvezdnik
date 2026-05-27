package llm

import (
	"encoding/json"
	"fmt"
	"strings"

	"zvezdnik/internal/domain"
)

func buildPortraitPrompt(chart *domain.NatalChart, tone string) string {
	var planets map[string]domain.PlanetPosition
	json.Unmarshal(chart.Planets, &planets)

	var lines []string
	for name, p := range planets {
		retro := ""
		if p.Retro {
			retro = " (ретроградный)"
		}
		lines = append(lines, fmt.Sprintf("- %s: %s в %d доме%s", name, SignToRu(p.Sign), p.House, retro))
	}

	toneDesc := "тепло и поддерживающе"
	if tone == "blunt" {
		toneDesc = "прямо и без прикрас"
	}

	patternsStr := "нет"
	if len(chart.AspectPatterns) > 0 && string(chart.AspectPatterns) != "null" {
		patternsStr = string(chart.AspectPatterns)
	}

	return fmt.Sprintf(`Ты астролог. Составь глубокий портрет личности на русском языке (1000-1500 слов).
Пиши живо, конкретно, без воды и без общих фраз.

Натальная карта:
%s
- Асцендент: %s
- Форма карты: %s
- Особые конфигурации: %s

Стиль подачи: %s`, strings.Join(lines, "\n"), SignToRu(chart.AscendantSign), ShapeToRu(chart.ChartShape), patternsStr, toneDesc)
}

func buildDailyPrompt(p domain.DailyContentParams) string {
	// Natal chart summary
	var natalLines []string
	for _, name := range []string{"Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"} {
		if pl, ok := p.Planets[name]; ok {
			retro := ""
			if pl.Retro {
				retro = " R"
			}
			natalLines = append(natalLines, fmt.Sprintf("%s в %s (%d дом)%s", name, SignToRu(pl.Sign), pl.House, retro))
		}
	}
	natalStr := strings.Join(natalLines, ", ")
	if natalStr == "" {
		natalStr = "нет данных"
	}

	// Personalization
	var pers struct {
		SelectedAreas []string          `json:"selectedAreas"`
		CurrentNeed   string            `json:"currentNeed"`
		Answers       map[string]string `json:"-"`
	}
	// Parse known fields + area answers
	var raw map[string]json.RawMessage
	json.Unmarshal(p.Personalization, &raw)
	json.Unmarshal(p.Personalization, &pers)

	var areasRu []string
	areaNames := map[string]string{
		"career": "Карьера", "love": "Любовь", "money": "Финансы", "health": "Здоровье",
		"family": "Семья", "creativity": "Творчество", "education": "Обучение", "spirit": "Духовность",
	}
	for _, a := range pers.SelectedAreas {
		if ru, ok := areaNames[a]; ok {
			areasRu = append(areasRu, ru)
		} else {
			areasRu = append(areasRu, a)
		}
	}

	areasStr := "не указаны"
	if len(areasRu) > 0 {
		areasStr = strings.Join(areasRu, ", ")
	}

	// Collect area answers
	var answersLines []string
	for k, v := range raw {
		if k == "selectedAreas" || k == "currentNeed" {
			continue
		}
		var val string
		json.Unmarshal(v, &val)
		if val != "" {
			if ru, ok := areaNames[k]; ok {
				answersLines = append(answersLines, fmt.Sprintf("%s: %s", ru, val))
			} else {
				answersLines = append(answersLines, fmt.Sprintf("%s: %s", k, val))
			}
		}
	}
	answersStr := "нет"
	if len(answersLines) > 0 {
		answersStr = strings.Join(answersLines, "; ")
	}

	needNames := map[string]string{
		"clarity": "Ясности", "confidence": "Уверенности", "calm": "Спокойствия",
		"courage": "Смелости", "energy": "Энергии", "support": "Опоры",
		"closeness": "Близости", "discipline": "Дисциплины", "inspiration": "Вдохновения",
	}
	needStr := "не указана"
	if n, ok := needNames[pers.CurrentNeed]; ok {
		needStr = n
	} else if pers.CurrentNeed != "" {
		needStr = pers.CurrentNeed
	}

	return fmt.Sprintf(`Ты персональный астролог в приложении Звездник. Составь индивидуальный прогноз на день.

Дата: %s (%s)

Натальная карта пользователя:
%s
Асцендент: %s
Форма карты: %s

Сферы фокуса пользователя: %s
Контекст по сферам: %s
Сейчас нуждается в: %s

Стиль подачи: %s

Прогноз должен быть ПЕРСОНАЛЬНЫМ — учитывай положения планет в натальной карте и их взаимодействие с текущими транзитами. Говори конкретно про сферы которые важны пользователю. Обращайся на "ты".

Верни только JSON, без markdown, без пояснений:
{
  "title": "мощное послание дня, одно предложение до 15 слов",
  "short_description": "развёрнутая расшифровка в 2-3 предложения, привязанная к натальной карте",
  "full_description": "подробный разбор на 4-6 абзацев — какие аспекты сегодня активны, как они взаимодействуют с натальными планетами, что с этим делать. Абзацы разделять двойным переводом строки",
  "do": ["конкретное короткое действие 2-4 слова", "ещё действие", "ещё действие"],
  "dont": ["короткое предупреждение 2-4 слова", "ещё", "ещё"],
  "push_title": "заголовок пуша до 8 слов"
}`,
		p.Date.Format("2006-01-02"), p.Weekday,
		natalStr, SignToRu(p.AscendantSign), ShapeToRu(p.ChartShape),
		areasStr, answersStr, needStr,
		p.ToneRu)
}

