package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/redis/go-redis/v9"

	"zvezdnik/internal/api/handler"
	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/bot"
	"zvezdnik/internal/db"
)

func NewRouter(
	botToken string,
	rdb *redis.Client,
	users *db.Queries,
	tgBot *bot.Bot,
	onboarding *handler.OnboardingHandler,
	today *handler.TodayHandler,
	void *handler.VoidHandler,
	chart *handler.ChartHandler,
	profile *handler.ProfileHandler,
	payments *handler.PaymentsHandler,
	compatibility *handler.CompatibilityHandler,
) *chi.Mux {
	r := chi.NewRouter()

	r.Use(chiMiddleware.RealIP)
	r.Use(middleware.RequestID)
	r.Use(middleware.Recovery)
	r.Use(middleware.RateLimit(rdb, 100, time.Minute))

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Telegram bot webhook (no auth needed, Telegram sends updates here)
	r.Post("/bot/webhook", tgBot.HandleWebhook)

	// Robokassa ResultURL (no auth — signature is verified inside). Robokassa
	// may deliver it via GET or POST depending on the cabinet setting.
	r.Get("/payments/webhook", payments.Webhook)
	r.Post("/payments/webhook", payments.Webhook)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Auth(botToken, users))

		r.Post("/onboarding", onboarding.Complete)
		r.Get("/today", today.GetToday)
		r.Get("/today/longread", today.GetLongread)
		r.Get("/void/credits", void.GetCredits)
		r.Get("/void", void.GetHistory)
		r.Post("/void/ask", void.Ask)
		r.Delete("/void/{id}", void.Delete)
		r.Get("/chart", chart.GetChart)
		r.Get("/profile", profile.GetProfile)
		r.Patch("/profile", profile.UpdateProfile)
		r.Post("/payments/create", payments.Create)
		r.Post("/payments/cancel", payments.Cancel)

		r.Get("/compatibility/credits", compatibility.GetCredits)
		r.Get("/compatibility", compatibility.GetHistory)
		r.Get("/compatibility/{id}", compatibility.GetCard)
		r.Post("/compatibility/generate", compatibility.Generate)
	})

	return r
}
