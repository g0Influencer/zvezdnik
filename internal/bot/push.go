package bot

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"zvezdnik/internal/content"
	"zvezdnik/internal/db"
)

const (
	fallbackPushTitle = "Звёздник: твой день готов 🌙"
	pushButtonLabel   = "Подробнее"
	// Abort the broadcast after this many consecutive failures: when Telegram is
	// unreachable every send burns the full HTTP timeout, so pushing on would
	// stall for minutes without delivering anything.
	maxConsecutiveSendFailures = 3
)

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

	sent, failures := 0, 0
	for _, user := range users {
		title := fallbackPushTitle
		var shortDesc string
		if tip != nil {
			if t := tip.PickTitle(user.Style); t != "" {
				title = t
			}
			shortDesc = tip.PickShortDescription(user.Style)
		}

		// Title, blank line, then the short teaser (same copy shown on the
		// app's main screen). The button reads "Подробнее" and opens the app.
		text := title
		if shortDesc != "" {
			text = title + "\n\n" + shortDesc
		}

		if err := ps.bot.SendMessageWithMiniAppButton(ctx, user.TelegramUserID, text, pushButtonLabel); err != nil {
			failures++
			slog.Error("daily push: send failed",
				"user_id", user.ID,
				"telegram_user_id", user.TelegramUserID,
				"error", err,
			)
			if failures >= maxConsecutiveSendFailures {
				slog.Error("daily push: aborting broadcast, Telegram unreachable",
					"consecutive_failures", failures, "sent", sent, "total", len(users))
				return fmt.Errorf("daily push: aborted after %d consecutive failures", failures)
			}
			continue
		}
		failures = 0
		sent++
	}

	slog.Info("daily pushes sent", "sent", sent, "user_count", len(users))
	return nil
}
