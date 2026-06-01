package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port string
	Env  string

	DatabaseURL string
	RedisURL    string

	TelegramBotToken   string
	TelegramMiniAppURL string
	WebhookBaseURL     string

	YandexAPIKey   string
	YandexFolderID string

	AstroNatalChartURL string

	ProdamusShopURL   string
	ProdamusSecretKey string

	PushCron  string
	TrialDays int

	SheetsSpreadsheetID string

	// Legal info for payment-provider compliance, surfaced via the bot's
	// /oferta command and a pinned message on /start.
	OfferURL        string
	SupplierName    string
	SupplierINN     string
	SupplierContact string
}

func init() {
	loadDotEnv(".env")
}

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		val = strings.Trim(val, "\"'")
		if os.Getenv(key) == "" {
			os.Setenv(key, val)
		}
	}
}

func Load() *Config {
	trialDays, _ := strconv.Atoi(getEnv("TRIAL_DAYS", "7"))

	return &Config{
		Port: getEnv("PORT", "8080"),
		Env:  getEnv("ENV", "development"),

		DatabaseURL: getEnv("DATABASE_URL", "postgres://zvezdnik:password@localhost:5432/zvezdnik"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),

		TelegramBotToken:   os.Getenv("TELEGRAM_BOT_TOKEN"),
		TelegramMiniAppURL: getEnv("TELEGRAM_MINI_APP_URL", "https://t.me/zvezdnik_bot/app"),
		WebhookBaseURL:     os.Getenv("WEBHOOK_BASE_URL"),

		YandexAPIKey:   os.Getenv("YANDEX_API_KEY"),
		YandexFolderID: os.Getenv("YANDEX_FOLDER_ID"),

		AstroNatalChartURL: os.Getenv("ASTRO_NATAL_CHART_URL"),

		ProdamusShopURL:   os.Getenv("PRODAMUS_SHOP_URL"),
		ProdamusSecretKey: os.Getenv("PRODAMUS_SECRET_KEY"),

		PushCron:  getEnv("PUSH_CRON", "0 9 * * *"),
		TrialDays: trialDays,

		SheetsSpreadsheetID: getEnv("SHEETS_SPREADSHEET_ID", "1Sjj2dEv6Zz_QnYB4BB0ON-4e9TepUnyrjXUjjKwNzEM"),

		OfferURL:        os.Getenv("OFFER_URL"),
		SupplierName:    os.Getenv("SUPPLIER_NAME"),
		SupplierINN:     os.Getenv("SUPPLIER_INN"),
		SupplierContact: os.Getenv("SUPPLIER_CONTACT"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
