package bot

import (
	"context"
	"log/slog"
	"time"

	"zvezdnik/internal/content"
	"zvezdnik/internal/db"
)

const fallbackPushTitle = "Звёздник: твой день готов 🌙"

type PushScheduler struct {
	bot     *Bot
	queries *db.Queries
	tips    *content.DailyTipsClient
}

func NewPushScheduler(bot *Bot, queries *db.Queries, tips *content.DailyTipsClient) *PushScheduler {
	return &PushScheduler{bot: bot, queries: queries, tips: tips}
}

func (ps *PushScheduler) SendDailyPushes(ctx context.Context) error {
	users, err := ps.queries.ListPushEnabledUsers(ctx)
	if err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")
	tip, err := ps.tips.LoadForDate(ctx, today)
	if err != nil {
		slog.Warn("daily push: failed to load daily tip, using fallback", "error", err)
	}

	slog.Info("sending daily pushes", "user_count", len(users), "date", today, "have_tip", tip != nil)

	for _, user := range users {
		title := fallbackPushTitle
		if tip != nil {
			if t := tip.PickTitle(user.Style); t != "" {
				title = t
			}
		}

		if err := ps.bot.SendMessageWithMiniApp(ctx, user.TelegramUserID, title); err != nil {
			slog.Error("daily push: send failed",
				"user_id", user.ID,
				"telegram_user_id", user.TelegramUserID,
				"error", err,
			)
			continue
		}
	}

	slog.Info("daily pushes sent", "user_count", len(users))
	return nil
}
