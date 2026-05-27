package handler

import (
	"encoding/json"
	"net/http"

	"zvezdnik/internal/httputil"
	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/service"
)

type OnboardingHandler struct {
	svc *service.OnboardingService
}

func NewOnboardingHandler(svc *service.OnboardingService) *OnboardingHandler {
	return &OnboardingHandler{svc: svc}
}

func (h *OnboardingHandler) Complete(w http.ResponseWriter, r *http.Request) {
	tgUser := middleware.GetTelegramUser(r.Context())
	user := middleware.GetUser(r.Context())

	var tg domain.TelegramUser
	if tgUser != nil {
		tg = *tgUser
	} else if user != nil {
		username := ""
		if user.Username != nil {
			username = *user.Username
		}
		displayName := ""
		if user.DisplayName != nil {
			displayName = *user.DisplayName
		}
		tg = domain.TelegramUser{
			ID:        user.TelegramUserID,
			Username:  username,
			FirstName: displayName,
		}
	} else {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeUnauthorized, "Не авторизован")
		return
	}

	var req service.OnboardingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный формат запроса")
		return
	}

	result, err := h.svc.Complete(r.Context(), tg, req)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}

	httputil.OK(w, result)
}
