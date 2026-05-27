package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/httputil"
	"zvezdnik/internal/service"
)

type VoidHandler struct {
	svc *service.VoidService
}

func NewVoidHandler(svc *service.VoidService) *VoidHandler {
	return &VoidHandler{svc: svc}
}

func (h *VoidHandler) GetCredits(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	result, err := h.svc.Credits(r.Context(), user)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}
	httputil.OK(w, result)
}

func (h *VoidHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	result, err := h.svc.History(r.Context(), user)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}
	httputil.OK(w, result)
}

type askVoidRequest struct {
	Question string `json:"question"`
}

func (h *VoidHandler) Ask(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	var req askVoidRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Question == "" {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Укажите вопрос")
		return
	}

	result, err := h.svc.Ask(r.Context(), user, req.Question)
	switch {
	case errors.Is(err, domain.ErrProRequired):
		httputil.Error(w, http.StatusForbidden, httputil.CodeProRequired, "Нужна Pro подписка")
	case errors.Is(err, domain.ErrVoidNoCredits):
		httputil.Error(w, http.StatusForbidden, httputil.CodeProRequired, "Лимит вопросов на этот месяц исчерпан")
	case err != nil:
		httputil.InternalError(w, err)
	default:
		httputil.OK(w, result)
	}
}

func (h *VoidHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	entryID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный id")
		return
	}

	if err := h.svc.Delete(r.Context(), user, entryID); err != nil {
		httputil.InternalError(w, err)
		return
	}
	httputil.OK(w, map[string]bool{"deleted": true})
}
