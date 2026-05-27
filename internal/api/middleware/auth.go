package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"

	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/httputil"
)

type ctxKeyUser struct{}

func Auth(botToken string, queries *db.Queries) func(http.Handler) http.Handler {
	env := os.Getenv("ENV")
	isDev := env == "development" || env == ""

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			initData := r.Header.Get("X-Telegram-Init-Data")
			slog.Debug("auth middleware", "initData_len", len(initData), "initData_empty", initData == "")

			if initData == "" {
				httputil.Error(w, http.StatusUnauthorized, httputil.CodeUnauthorized, "Отсутствуют данные авторизации")
				return
			}

			tgUser, err := validateTelegramInitData(initData, botToken)
			if err != nil && isDev {
				slog.Warn("dev mode: HMAC validation failed, parsing user without validation", "error", err)
				tgUser, err = parseTelegramUserFromInitData(initData)
			}
			if err != nil {
				slog.Warn("auth failed", "error", err)
				httputil.Error(w, http.StatusUnauthorized, httputil.CodeUnauthorized, "Неверные данные авторизации")
				return
			}

			user, err := queries.GetUserByTelegramUserID(r.Context(), tgUser.ID)
			if err != nil {
				if !db.IsNotFound(err) {
					slog.Error("auth: lookup user", "error", err)
				}
				ctx := context.WithValue(r.Context(), ctxKeyUser{}, &tgUser)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyUser{}, &user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUser(ctx context.Context) *domain.User {
	if u, ok := ctx.Value(ctxKeyUser{}).(*domain.User); ok {
		return u
	}
	return nil
}

func GetTelegramUser(ctx context.Context) *domain.TelegramUser {
	if u, ok := ctx.Value(ctxKeyUser{}).(*domain.TelegramUser); ok {
		return u
	}
	return nil
}

func validateTelegramInitData(initData, botToken string) (domain.TelegramUser, error) {
	vals, err := url.ParseQuery(initData)
	if err != nil {
		return domain.TelegramUser{}, fmt.Errorf("parse init data: %w", err)
	}

	hash := vals.Get("hash")
	if hash == "" {
		return domain.TelegramUser{}, fmt.Errorf("missing hash")
	}

	vals.Del("hash")
	var keys []string
	for k := range vals {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var pairs []string
	for _, k := range keys {
		pairs = append(pairs, k+"="+vals.Get(k))
	}
	dataCheckString := strings.Join(pairs, "\n")

	secretKey := hmacSHA256([]byte("WebAppData"), []byte(botToken))

	expectedHash := hex.EncodeToString(hmacSHA256(secretKey, []byte(dataCheckString)))
	if expectedHash != hash {
		return domain.TelegramUser{}, fmt.Errorf("invalid hash")
	}

	userJSON := vals.Get("user")
	if userJSON == "" {
		return domain.TelegramUser{}, fmt.Errorf("missing user data")
	}

	var tgUser domain.TelegramUser
	if err := json.Unmarshal([]byte(userJSON), &tgUser); err != nil {
		return domain.TelegramUser{}, fmt.Errorf("parse user json: %w", err)
	}

	return tgUser, nil
}

func parseTelegramUserFromInitData(initData string) (domain.TelegramUser, error) {
	vals, err := url.ParseQuery(initData)
	if err != nil {
		return domain.TelegramUser{}, fmt.Errorf("parse init data: %w", err)
	}
	userJSON := vals.Get("user")
	if userJSON == "" {
		return domain.TelegramUser{}, fmt.Errorf("missing user data")
	}
	var tgUser domain.TelegramUser
	if err := json.Unmarshal([]byte(userJSON), &tgUser); err != nil {
		return domain.TelegramUser{}, fmt.Errorf("parse user json: %w", err)
	}
	return tgUser, nil
}

func hmacSHA256(key, data []byte) []byte {
	h := hmac.New(sha256.New, key)
	h.Write(data)
	return h.Sum(nil)
}
