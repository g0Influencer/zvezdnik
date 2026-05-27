package astro

import (
	"fmt"
	"time"
)

func GetHistoricalTimezone(lat, lon float64, birthDate time.Time, city string) (float64, error) {
	loc, err := time.LoadLocation(guessTimezone(lat, lon, city))
	if err != nil {
		return 3.0, nil
	}
	t := time.Date(birthDate.Year(), birthDate.Month(), birthDate.Day(), 12, 0, 0, 0, loc)
	_, offset := t.Zone()
	return float64(offset) / 3600, nil
}

func guessTimezone(lat, lon float64, city string) string {
	// Simplified timezone detection based on longitude and known cities
	switch {
	case contains(city, "Москва", "Moscow"):
		return "Europe/Moscow"
	case contains(city, "Санкт-Петербург", "Petersburg"):
		return "Europe/Moscow"
	case contains(city, "Новосибирск"):
		return "Asia/Novosibirsk"
	case contains(city, "Екатеринбург"):
		return "Asia/Yekaterinburg"
	case contains(city, "Владивосток"):
		return "Asia/Vladivostok"
	case contains(city, "Красноярск"):
		return "Asia/Krasnoyarsk"
	case contains(city, "Самара"):
		return "Europe/Samara"
	case contains(city, "Калининград"):
		return "Europe/Kaliningrad"
	case contains(city, "Киев", "Kyiv"):
		return "Europe/Kiev"
	case contains(city, "Минск", "Minsk"):
		return "Europe/Minsk"
	default:
		// Rough estimate based on longitude
		offsetHours := lon / 15.0
		if offsetHours >= 0 {
			return fmt.Sprintf("Etc/GMT-%d", int(offsetHours+0.5))
		}
		return fmt.Sprintf("Etc/GMT+%d", int(-offsetHours+0.5))
	}
}

func contains(city string, variants ...string) bool {
	for _, v := range variants {
		if len(city) >= len(v) {
			for i := 0; i <= len(city)-len(v); i++ {
				if city[i:i+len(v)] == v {
					return true
				}
			}
		}
	}
	return false
}
