package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"zvezdnik/internal/domain"
)

const compatibilityScoreDefaultMin = 0
const compatibilityScoreDefaultMax = 100

func (c *Client) GenerateCompatibility(ctx context.Context, p domain.CompatibilityParams) (*domain.CompatibilityResult, error) {
	systemPrompt := buildCompatibilitySystemPrompt(p)
	userPrompt := buildCompatibilityUserPrompt(p)

	text, err := c.generate(ctx, systemPrompt, userPrompt, 4500, 1.0, true)
	if err != nil {
		return nil, fmt.Errorf("llm generate compatibility: %w", err)
	}

	text = stripJSONFences(text)

	var raw domain.CompatibilityResult
	if err := json.Unmarshal([]byte(text), &raw); err != nil {
		return nil, fmt.Errorf("llm parse compatibility json: %w (raw: %s)", err, text[:min(len(text), 200)])
	}

	return normalizeCompatibility(&raw), nil
}

func buildCompatibilitySystemPrompt(p domain.CompatibilityParams) string {
	styleDesc := "мягкий, бережный, тёплый, но без сюсюканья"
	if p.UserStyle == domain.StyleBlunt {
		styleDesc = "прямой, честный, немного провокационный, но без грубости"
	}

	loveDesc := "Пользователь НЕ включил любовную совместимость. Не называй связь дружбой, не говори 'как друг/подруга'. Пиши нейтрально: контакт, динамика, притяжение, различия, общение, человеческая совместимость."
	if p.IncludeLove {
		loveDesc = "Пользователь включил любовную совместимость. Можно писать про притяжение, близость, романтическую динамику, желание, ревность, ожидание, дистанцию и страхи в отношениях."
	}

	return fmt.Sprintf(`
Ты — премиальный раздел приложения "Звездник": "Карта другого человека и ваша совместимость".

Пользователь вводит данные рождения другого человека и получает:
1. описание человека по его натальной карте;
2. скрытые интересные стороны этого человека;
3. общие стороны пользователя и этого человека;
4. главные различия;
5. совместимость в процентах и текстом;
6. как с этим человеком лучше общаться.

Это не классический гороскоп и не психологический тест.
Текст должен звучать как персональная, стильная, немного мистическая интерпретация.

Главный акцент — на другом человеке.
Данные текущего пользователя можно учитывать фоном, но не нужно подробно пересказывать его натальную карту.

Правила:
- пиши на русском;
- обращайся на "ты";
- не используй эмодзи;
- не говори, что ты искусственный интеллект;
- не обещай точных событий;
- не используй фразу "звезды говорят";
- не делай медицинских, психологических, юридических или финансовых выводов;
- не ставь диагнозы;
- не называй человека токсичным, опасным, абьюзером или нарциссом;
- не пиши категорично: "вы точно будете вместе", "он тебя любит", "она тебя любит", "отношения обречены";
- не используй грубость;
- не уходи в банальную эзотерику;
- не перегружай текст астрологическими терминами;
- можно использовать образы: Луна, Венера, Марс, Сатурн, Меркурий, аспект, дом, узел, напряжение, стихия, ритм карты;
- каждый блок должен давать ощущение скрытого инсайта, а не общей статьи.

Стиль:
%s

Любовная совместимость:
%s

Формат ответа:
Верни только валидный JSON.
Не добавляй markdown.
Не добавляй пояснения до или после JSON.

Структура JSON строго такая:
{
  "title": "string",
  "shortDescription": "string",
  "compatibilityScore": number,
  "compatibilityLabel": "string",
  "sections": [
    { "id": "person_core",       "title": "Как устроен этот человек",        "text": "string" },
    { "id": "hidden_sides",      "title": "Скрытые стороны",                 "text": "string" },
    { "id": "closeness_style",   "title": "Как он проявляется в близости",   "text": "string" },
    { "id": "common_sides",      "title": "Что у вас похоже",                "text": "string" },
    { "id": "differences",       "title": "Где вы разные",                   "text": "string" },
    { "id": "compatibility",     "title": "Ваша совместимость",              "text": "string" },
    { "id": "how_to_communicate","title": "Как с ним общаться",              "text": "string" }
  ],
  "dos": ["string", "string", "string"],
  "donts": ["string", "string", "string"]
}

Требования к длине:
- shortDescription: 1–2 предложения;
- compatibilityLabel: короткая фраза до 8 слов;
- compatibilityScore: число от 45 до 95, без знака процента;
- каждый section.text: 80–130 слов;
- dos: ровно 3 пункта;
- donts: ровно 3 пункта.

Пункты dos/donts должны быть конкретными и поведенческими.
Не пиши абстрактно: "будь собой", "слушай сердце", "доверяй вселенной".
`, styleDesc, loveDesc)
}

func buildCompatibilityUserPrompt(p domain.CompatibilityParams) string {
	birthTime := "не указано"
	if p.OtherBirthTime != nil && *p.OtherBirthTime != "" {
		birthTime = *p.OtherBirthTime
	} else if p.OtherBirthTime == nil {
		birthTime = "неизвестно"
	}

	birthPlace := "не указан"
	if p.OtherBirthPlace != nil && *p.OtherBirthPlace != "" {
		birthPlace = *p.OtherBirthPlace
	} else if p.OtherBirthPlace == nil {
		birthPlace = "неизвестен"
	}

	genderRu := "мужской"
	if p.OtherGender == domain.GenderFemale {
		genderRu = "женский"
	}

	natalChart := "не передана"
	if p.NatalChartText != "" {
		natalChart = p.NatalChartText
	}

	return fmt.Sprintf(`
Данные другого человека:
Дата рождения: %s
Время рождения: %s
Город рождения: %s
Пол: %s

Данные пользователя:
Стиль приложения: %s
Готовая натальная карта пользователя, если есть:
%s

Нужно создать премиальный лонгрид "Карта другого человека и ваша совместимость".

Сделай текст таким, чтобы у пользователя было ощущение:
- он увидел человека глубже;
- понял его скрытые стороны;
- понял, где они похожи;
- понял, где между ними могут быть различия;
- получил аккуратную, но интересную оценку совместимости.

Верни только JSON по заданной структуре.
`,
		p.OtherBirthDate.Format("2006-01-02"),
		birthTime,
		birthPlace,
		genderRu,
		p.UserStyle,
		natalChart,
	)
}

func normalizeCompatibility(r *domain.CompatibilityResult) *domain.CompatibilityResult {
	if r.Title == "" {
		r.Title = "Карта другого человека"
	}
	if r.ShortDescription == "" {
		r.ShortDescription = "Описание человека по его натальной карте, ваши общие стороны и главные различия."
	}
	if r.CompatibilityLabel == "" {
		r.CompatibilityLabel = "интересная динамика с разными ритмами"
	}
	if r.CompatibilityScore < compatibilityScoreDefaultMin {
		r.CompatibilityScore = compatibilityScoreDefaultMin
	}
	if r.CompatibilityScore > compatibilityScoreDefaultMax {
		r.CompatibilityScore = compatibilityScoreDefaultMax
	}
	if r.Sections == nil {
		r.Sections = []domain.CompatibilitySection{}
	}
	if r.Dos == nil {
		r.Dos = []string{}
	}
	if r.Donts == nil {
		r.Donts = []string{}
	}
	return r
}
