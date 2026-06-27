package bot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
)

type Bot struct {
	token      string
	miniAppURL string
	legal      LegalInfo
	httpClient *http.Client
}

// LegalInfo holds payment-provider compliance data shown via /oferta and the
// pinned message on /start. All fields come from config/env.
type LegalInfo struct {
	OfferURL        string
	SupplierName    string
	SupplierINN     string
	SupplierContact string
}

// configured reports whether enough legal data is set to surface the offer.
func (l LegalInfo) configured() bool {
	return l.OfferURL != "" && l.SupplierName != ""
}

func NewBot(token, miniAppURL string, legal LegalInfo) *Bot {
	return &Bot{
		token:      token,
		miniAppURL: miniAppURL,
		legal:      legal,
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

	// Ignore non-text updates (service messages, web-app data, the events Telegram
	// emits when a user opens/restarts the bot). They must not hit handleDefault,
	// which would otherwise post a spurious second "open the app" block.
	if update.Message.Text == "" {
		w.WriteHeader(http.StatusOK)
		return
	}

	switch update.Message.Text {
	case "/start":
		b.handleStart(r.Context(), update.Message)
	case "/help":
		b.handleHelp(r.Context(), update.Message)
	case "/oferta":
		b.handleOferta(r.Context(), update.Message)
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

	// Pin the supplier requisites + public offer once per chat (payment-provider
	// requirement: legal info available in the bot). Skip if the chat already has
	// a pinned message, so repeated /start commands don't re-post it.
	if b.legal.configured() && !b.chatHasPinnedMessage(ctx, msg.Chat.ID) {
		msgID, err := b.sendMessageReturningID(ctx, sendMessageRequest{
			ChatID:    msg.Chat.ID,
			Text:      b.legalText(),
			ParseMode: "HTML",
		})
		if err != nil {
			slog.Error("bot: send legal message", "chat_id", msg.Chat.ID, "error", err)
			return
		}
		if err := b.pinChatMessage(ctx, msg.Chat.ID, msgID); err != nil {
			slog.Warn("bot: pin legal message", "chat_id", msg.Chat.ID, "error", err)
		}
	}
}

// chatHasPinnedMessage reports whether the chat already has a pinned message.
// Used to pin the legal block only once. On any error it returns false (so we
// fall back to pinning), which is safe for a compliance message.
func (b *Bot) chatHasPinnedMessage(ctx context.Context, chatID int64) bool {
	payload, _ := json.Marshal(map[string]int64{"chat_id": chatID})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/getChat", b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return false
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return false
	}

	var result struct {
		Result struct {
			PinnedMessage *struct {
				MessageID int64 `json:"message_id"`
			} `json:"pinned_message"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false
	}
	return result.Result.PinnedMessage != nil
}

func (b *Bot) handleOferta(ctx context.Context, msg *Message) {
	if !b.legal.configured() {
		if err := b.SendMessage(ctx, msg.Chat.ID, "Реквизиты скоро появятся."); err != nil {
			slog.Error("bot: handle /oferta (unconfigured)", "chat_id", msg.Chat.ID, "error", err)
		}
		return
	}
	if err := b.sendMessage(ctx, sendMessageRequest{
		ChatID:    msg.Chat.ID,
		Text:      b.legalText(),
		ParseMode: "HTML",
	}); err != nil {
		slog.Error("bot: handle /oferta", "chat_id", msg.Chat.ID, "error", err)
	}
}

// legalText builds the supplier + offer block. HTML parse mode makes the offer
// link clickable. Callers must check legal.configured() first.
func (b *Bot) legalText() string {
	var sb strings.Builder
	sb.WriteString("<b>Реквизиты и публичная оферта</b>\n\n")
	sb.WriteString("Поставщик услуг: " + htmlEscape(b.legal.SupplierName) + "\n")
	if b.legal.SupplierINN != "" {
		sb.WriteString("ИНН: " + htmlEscape(b.legal.SupplierINN) + "\n")
	}
	if b.legal.SupplierContact != "" {
		sb.WriteString("Контакты: " + htmlEscape(b.legal.SupplierContact) + "\n")
	}
	sb.WriteString("\n<a href=\"" + htmlEscape(b.legal.OfferURL) + "\">Публичная оферта</a>")
	return sb.String()
}

func htmlEscape(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
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
	return b.SendMessageWithMiniAppButton(ctx, chatID, text, "Открыть Звездник")
}

// SendMessageWithMiniAppButton sends a message with a single inline button that
// opens the Mini App. buttonLabel tailors the call-to-action — e.g. "Подробнее"
// for the daily push vs. the default "Открыть Звездник".
func (b *Bot) SendMessageWithMiniAppButton(ctx context.Context, chatID int64, text, buttonLabel string) error {
	return b.sendMessage(ctx, sendMessageRequest{
		ChatID: chatID,
		Text:   text,
		ReplyMarkup: inlineKeyboardMarkup{
			InlineKeyboard: [][]inlineKeyboardButton{
				{
					{
						Text:   buttonLabel,
						WebApp: &webAppInfo{URL: b.miniAppURL},
					},
				},
			},
		},
	})
}

func (b *Bot) sendMessage(ctx context.Context, msg sendMessageRequest) error {
	_, err := b.sendMessageReturningID(ctx, msg)
	return err
}

// sendMessageReturningID sends a message and returns the new message_id, needed
// when the message must subsequently be pinned.
func (b *Bot) sendMessageReturningID(ctx context.Context, msg sendMessageRequest) (int64, error) {
	body, err := json.Marshal(msg)
	if err != nil {
		return 0, fmt.Errorf("marshal message: %w", err)
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("send message: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		slog.Error("telegram api error", "status", resp.StatusCode, "body", string(respBody))
		return 0, fmt.Errorf("telegram api error: %d", resp.StatusCode)
	}

	var result struct {
		Result struct {
			MessageID int64 `json:"message_id"`
		} `json:"result"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return 0, fmt.Errorf("decode send message response: %w", err)
	}
	return result.Result.MessageID, nil
}

// pinChatMessage pins a message in the chat. Notification is disabled to avoid
// nagging the user with a "pinned" alert on every /start.
func (b *Bot) pinChatMessage(ctx context.Context, chatID, messageID int64) error {
	payload, _ := json.Marshal(map[string]interface{}{
		"chat_id":              chatID,
		"message_id":           messageID,
		"disable_notification": true,
	})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/pinChatMessage", b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create pin request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("pin message: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pin message: status=%d body=%s", resp.StatusCode, string(respBody))
	}
	return nil
}

// SetMyCommands registers the bot's command menu (the "/" button). Called once
// at startup. /oferta is included only when legal info is configured.
func (b *Bot) SetMyCommands(ctx context.Context) error {
	type botCommand struct {
		Command     string `json:"command"`
		Description string `json:"description"`
	}
	commands := []botCommand{
		{Command: "start", Description: "Открыть приложение"},
		{Command: "help", Description: "Помощь"},
	}
	if b.legal.configured() {
		commands = append(commands, botCommand{Command: "oferta", Description: "Оферта и реквизиты"})
	}

	payload, _ := json.Marshal(map[string]interface{}{"commands": commands})
	url := fmt.Sprintf("https://api.telegram.org/bot%s/setMyCommands", b.token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create setMyCommands request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := b.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("set commands: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("set commands: status=%d body=%s", resp.StatusCode, string(respBody))
	}
	slog.Info("telegram bot commands set", "count", len(commands))
	return nil
}
