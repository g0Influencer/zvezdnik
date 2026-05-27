package llm

import "strings"

var focusRu = map[string]string{
	"work":    "Работа",
	"money":   "Деньги",
	"love":    "Любовь",
	"friends": "Друзья",
	"body":    "Тело",
	"self":    "Самоценность",
}

var toneRu = map[string]string{
	"gentle": "мягкий и поддерживающий",
	"blunt":  "прямой и без фильтров",
}

var signRu = map[string]string{
	"Aries": "Овен", "Taurus": "Телец", "Gemini": "Близнецы",
	"Cancer": "Рак", "Leo": "Лев", "Virgo": "Дева",
	"Libra": "Весы", "Scorpio": "Скорпион", "Sagittarius": "Стрелец",
	"Capricorn": "Козерог", "Aquarius": "Водолей", "Pisces": "Рыбы",
}

var shapeRu = map[string]string{
	"bundle":     "Связка",
	"bowl":       "Чаша",
	"bucket":     "Корзина",
	"locomotive": "Локомотив",
	"seesaw":     "Качели",
	"splash":     "Брызги",
	"splay":      "Веер",
}

func SignToRu(sign string) string {
	if ru, ok := signRu[sign]; ok {
		return ru
	}
	return sign
}

func ShapeToRu(shape string) string {
	if ru, ok := shapeRu[strings.ToLower(shape)]; ok {
		return ru
	}
	return shape
}

func FocusToRu(focus string) string {
	if ru, ok := focusRu[focus]; ok {
		return ru
	}
	return focus
}

func ToneToRu(tone string) string {
	if ru, ok := toneRu[tone]; ok {
		return ru
	}
	return tone
}
