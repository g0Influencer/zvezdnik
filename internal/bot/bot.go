package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
)

type Bot struct {
	token      string
	miniAppURL string
	httpClient *http.Client
}

func NewBot(token, miniAppURL string) *Bot {
	return &Bot{
		token:      token,
		miniAppURL: miniAppURL,
		httpClient: &http.Client{},
	}
}

// Telegram types

type Update struct {
	UpdateID int64    `json:"update_id"`
	Message  *Message `json:"message,omitempty"`
}

type Message struct {
	MessageID int64  `json:"message_id"`
	Chat      Chat   `json:"chat"`
	Text      string `json:"text"`
	From      *From  `json:"from,omitempty"`
}

type Chat struct {
	ID int64 `json:"id"`
}

type From struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	Username  string `json:"username"`
}

type sendMessageRequest struct {
	ChatID      int64       `json:"chat_id"`
	Text        string      `json:"text"`
	ParseMode   string      `json:"parse_mode,omitempty"`
	ReplyMarkup interface{} `json:"reply_markup,omitempty"`
}

type inlineKeyboardMarkup struct {
	InlineKeyboard [][]inlineKeyboardButton `json:"inline_keyboard"`
}

type inlineKeyboardButton struct {
	Text   string      `json:"text"`
	URL    string      `json:"url,omitempty"`
	WebApp *webAppInfo `json:"web_app,omitempty"`
}

type webAppInfo struct {
	URL string `json:"url"`
}

// SetWebhook registers the webhook URL with Telegram.
func (b *Bot) SetWebhook(ctx context.Context, webhookURL string) error {
	payload, _ := json.Marshal(map[string]string{"url": webhookURL})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook", b.token)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("set webhook: create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("set webhook: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("set webhook: status=%d body=%s", resp.StatusCode, string(body))
	}

	slog.Info("telegram webhook set", "url", webhookURL)
	return nil
}

// HandleWebhook processes incoming Telegram updates.
// This is the HTTP handler for POST /bot/webhook.
func (b *Bot) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	var update Update
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		slog.Error("bot: decode update", "error", err)
		w.WriteHeader(http.StatusOK) // always 200 to Telegram
		return
	}

	if update.Message == nil {
		w.WriteHeader(http.StatusOK)
		return
	}

	switch update.Message.Text {
	case "/start":
		b.handleStart(r.Context(), update.Message)
	case "/help":
		b.handleHelp(r.Context(), update.Message)
	default:
		b.handleDefault(r.Context(), update.Message)
	}

	w.WriteHeader(http.StatusOK)
}

func (b *Bot) handleStart(ctx context.Context, msg *Message) {
	text := "Привет! Я Звездник — твой персональный астролог.\n\nНажми кнопку ниже, чтобы открыть приложение и узнать свой прогноз."
	if err := b.SendMessageWithMiniApp(ctx, msg.Chat.ID, text); err != nil {
		slog.Error("bot: handle /start", "chat_id", msg.Chat.ID, "error", err)
	}
}

func (b *Bot) handleHelp(ctx context.Context, msg *Message) {
	text := "Звездник AI — персональная астрология.\n\n" +
		"Нажми кнопку ниже, чтобы открыть приложение.\n" +
		"Внутри: дневной прогноз, натальная карта, чат с астрологом."
	if err := b.SendMessageWithMiniApp(ctx, msg.Chat.ID, text); err != nil {
		slog.Error("bot: handle /help", "chat_id", msg.Chat.ID, "error", err)
	}
}

func (b *Bot) handleDefault(ctx context.Context, msg *Message) {
	text := "Открой приложение, чтобы задать вопрос астрологу:"
	if err := b.SendMessageWithMiniApp(ctx, msg.Chat.ID, text); err != nil {
		slog.Error("bot: handle default", "chat_id", msg.Chat.ID, "error", err)
	}
}

func (b *Bot) SendMessage(ctx context.Context, chatID int64, text string) error {
	return b.sendMessage(ctx, sendMessageRequest{
		ChatID: chatID,
		Text:   text,
	})
}

func (b *Bot) SendMessageWithMiniApp(ctx context.Context, chatID int64, text string) error {
	return b.sendMessage(ctx, sendMessageRequest{
		ChatID: chatID,
		Text:   text,
		ReplyMarkup: inlineKeyboardMarkup{
			InlineKeyboard: [][]inlineKeyboardButton{
				{
					{
						Text:   "Открыть Звездник",
						WebApp: &webAppInfo{URL: b.miniAppURL},
					},
				},
			},
		},
	})
}

func (b *Bot) sendMessage(ctx context.Context, msg sendMessageRequest) error {
	body, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		slog.Error("telegram api error", "status", resp.StatusCode, "body", string(respBody))
		return fmt.Errorf("telegram api error: %d", resp.StatusCode)
	}

	return nil
}
