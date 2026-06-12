package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/robfig/cron/v3"

	"zvezdnik/internal/api"
	"zvezdnik/internal/api/handler"
	"zvezdnik/internal/astro"
	"zvezdnik/internal/bot"
	"zvezdnik/internal/config"
	"zvezdnik/internal/content"
	"zvezdnik/internal/db"
	"zvezdnik/internal/llm"
	"zvezdnik/internal/payments"
	"zvezdnik/internal/service"
)

func main() {
	cfg := config.Load()

	// Setup structured logging
	logLevel := slog.LevelInfo
	if cfg.Env == "development" {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel})))

	// Connect PostgreSQL
	ctx := context.Background()
	dbPool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()

	if err := dbPool.Ping(ctx); err != nil {
		slog.Error("failed to ping database", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to PostgreSQL")

	// Run migrations
	if err := runMigrations(ctx, dbPool); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Connect Redis
	redisOpts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		slog.Error("failed to parse redis url", "error", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(redisOpts)
	defer rdb.Close()

	if err := rdb.Ping(ctx).Err(); err != nil {
		slog.Error("failed to ping redis", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to Redis")

	// Init external clients
	astroClient := astro.NewClient(cfg.AstroNatalChartURL)
	llmClient := llm.NewClient(cfg.YandexAPIKey, cfg.YandexFolderID)

	// Init queries (sqlc-generated)
	queries := db.New(dbPool)

	// Init services
	onboardingSvc := service.NewOnboardingService(queries, astroClient, llmClient)
	todaySvc := service.NewTodayService(queries, astroClient, llmClient, rdb)
	voidSvc := service.NewVoidService(queries, llmClient)
	chartSvc := service.NewChartService(queries)
	robokassa := payments.NewClient(payments.Config{
		MerchantLogin: cfg.RobokassaMerchantLogin,
		Password1:     cfg.RobokassaPassword1,
		Password2:     cfg.RobokassaPassword2,
		TestPassword1: cfg.RobokassaTestPassword1,
		TestPassword2: cfg.RobokassaTestPassword2,
		IsTest:        cfg.RobokassaIsTest,
		HashAlgo:      cfg.RobokassaHashAlgo,
		Fiscal:        cfg.RobokassaFiscal,
	})
	paymentsSvc := service.NewPaymentsService(queries, robokassa, cfg.RobokassaRecurring, cfg.OfferURL)
	compatibilitySvc := service.NewCompatibilityService(queries, llmClient)

	// Init handlers
	onboardingH := handler.NewOnboardingHandler(onboardingSvc)
	todayH := handler.NewTodayHandler(todaySvc)
	voidH := handler.NewVoidHandler(voidSvc)
	chartH := handler.NewChartHandler(chartSvc)
	profileH := handler.NewProfileHandler(queries)
	paymentsH := handler.NewPaymentsHandler(paymentsSvc)
	compatibilityH := handler.NewCompatibilityHandler(compatibilitySvc)

	// Init Telegram bot
	tgBot := bot.NewBot(cfg.TelegramBotToken, cfg.TelegramMiniAppURL, bot.LegalInfo{
		OfferURL:        cfg.OfferURL,
		SupplierName:    cfg.SupplierName,
		SupplierINN:     cfg.SupplierINN,
		SupplierContact: cfg.SupplierContact,
	})

	// Set webhook if URL is configured
	if cfg.WebhookBaseURL != "" {
		webhookURL := cfg.WebhookBaseURL + "/bot/webhook"
		if err := tgBot.SetWebhook(ctx, webhookURL); err != nil {
			slog.Error("failed to set telegram webhook", "error", err)
		}
	}

	// Register the bot command menu (/start, /help, /oferta).
	if err := tgBot.SetMyCommands(ctx); err != nil {
		slog.Error("failed to set telegram bot commands", "error", err)
	}

	// Init router
	router := api.NewRouter(
		cfg.TelegramBotToken,
		rdb,
		queries,
		tgBot,
		onboardingH, todayH, voidH, chartH, profileH, paymentsH, compatibilityH,
	)

	// Init push scheduler
	tipsClient := content.NewDailyTipsClient(cfg.SheetsSpreadsheetID)
	pushScheduler := bot.NewPushScheduler(tgBot, queries, tipsClient)

	// Setup cron for daily pushes
	c := cron.New(cron.WithLocation(time.FixedZone("MSK", 3*60*60)))
	_, err = c.AddFunc(cfg.PushCron, func() {
		pushCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
		defer cancel()
		if err := pushScheduler.SendDailyPushes(pushCtx); err != nil {
			slog.Error("daily push failed", "error", err)
		}
	})
	if err != nil {
		slog.Error("failed to setup cron", "error", err)
		os.Exit(1)
	}

	// Recurring (API-recurring) charge scheduler — only when enabled. Robokassa
	// does not drive these; we initiate each child charge ourselves. The 23h
	// per-subscription guard in the query keeps it to one attempt per day.
	if cfg.RobokassaRecurring {
		if _, err := c.AddFunc("0 */6 * * *", func() {
			recCtx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
			defer cancel()
			if err := paymentsSvc.ChargeDueRecurring(recCtx); err != nil {
				slog.Error("recurring charge cron failed", "error", err)
			}
		}); err != nil {
			slog.Error("failed to setup recurring cron", "error", err)
		}
	}

	c.Start()
	defer c.Stop()

	// Start HTTP server
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		slog.Info("server starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}
	slog.Info("server stopped")
}

func runMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	const dir = "migrations"

	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		data, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return fmt.Errorf("read %s: %w", name, err)
		}
		if _, err := pool.Exec(ctx, string(data)); err != nil {
			slog.Warn("migration may have already been applied", "file", name, "error", err)
		} else {
			slog.Info("migration applied", "file", name)
		}
	}
	return nil
}
