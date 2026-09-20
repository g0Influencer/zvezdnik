package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// Long polling — the fallback when Telegram cannot open connections to this
// host. Since 2026-09 the webhook fails with "Connection timed out" against
// 51.250.103.115 while outbound calls to api.telegram.org keep working (the
// daily broadcast goes out fine), so inbound is filtered but outbound is not.
// Polling only ever uses the outbound direction: the server asks for updates
// itself instead of waiting to be called. Selected with TELEGRAM_MODE=polling.

const (
	// Seconds Telegram holds an empty getUpdates open. Long enough to keep the
	// request count low, short enough that a dead connection is noticed soon.
	pollTimeoutSeconds = 30
	// The HTTP client must outlive the server-side hold, otherwise every poll
	// is cut mid-flight and looks like a network error.
	pollClientTimeout = (pollTimeoutSeconds + 10) * time.Second

	pollBackoffMin = 2 * time.Second
	pollBackoffMax = 60 * time.Second
)

// RunPolling fetches updates in a loop until ctx is cancelled. Blocking; run it
// in its own goroutine. Errors are logged and retried with exponential backoff
// rather than returned — the loop is the bot's only input in polling mode and
// must survive transient outages.
func (b *Bot) RunPolling(ctx context.Context) {
	client := &http.Client{Timeout: pollClientTimeout}

	// Telegram rejects getUpdates with 409 while a webhook is registered, and a
	// stale registration outlives restarts, so always clear it first.
	if err := b.DeleteWebhook(ctx); err != nil {
		slog.Error("bot: delete webhook before polling", "error", err)
	}

	slog.Info("telegram polling started", "timeout_s", pollTimeoutSeconds)

	var offset int64
	backoff := pollBackoffMin

	for {
		updates, err := b.getUpdates(ctx, client, offset)
		if err != nil {
			if ctx.Err() != nil {
				slog.Info("telegram polling stopped")
				return
			}
			slog.Error("bot: get updates", "error", err, "retry_in", backoff)
			select {
			case <-ctx.Done():
				slog.Info("telegram polling stopped")
				return
			case <-time.After(backoff):
			}
			if backoff *= 2; backoff > pollBackoffMax {
				backoff = pollBackoffMax
			}
			continue
		}
		backoff = pollBackoffMin

		for _, u := range updates {
			// Advance the offset before handling: an update that makes a handler
			// panic or fail must not be re-delivered forever.
			if u.UpdateID >= offset {
				offset = u.UpdateID + 1
			}
			b.handleUpdate(ctx, u)
		}
	}
}

// DeleteWebhook clears the registered webhook URL, if any.
func (b *Bot) DeleteWebhook(ctx context.Context) error {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/deleteWebhook", b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return fmt.Errorf("delete webhook: create request: %w", err)
	}

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("delete webhook: %w", b.scrub(err))
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("delete webhook: status=%d body=%s", resp.StatusCode, string(body))
	}

	slog.Info("telegram webhook deleted")
	return nil
}

// getUpdates returns updates with update_id >= offset, waiting up to
// pollTimeoutSeconds for the first one. An empty slice after the wait is the
// normal idle result, not an error.
func (b *Bot) getUpdates(ctx context.Context, client *http.Client, offset int64) ([]Update, error) {
	payload, _ := json.Marshal(map[string]interface{}{
		"offset":  offset,
		"timeout": pollTimeoutSeconds,
		// Only message updates are dispatched (see handleUpdate); asking for the
		// rest would just inflate responses.
		"allowed_updates": []string{"message"},
	})

	url := fmt.Sprintf("https://api.telegram.org/bot%s/getUpdates", b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, b.scrub(err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		// 409 here means a webhook is still registered — the deleteWebhook above
		// failed and the body says so.
		return nil, &APIError{StatusCode: resp.StatusCode, Body: string(body)}
	}

	var result struct {
		OK     bool     `json:"ok"`
		Result []Update `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("decode updates: %w", err)
	}
	return result.Result, nil
}
