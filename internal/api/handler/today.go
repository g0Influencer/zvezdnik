package handler

import (
	"net/http"

	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/httputil"
	"zvezdnik/internal/service"
)

type TodayHandler struct {
	svc *service.TodayService
}

func NewTodayHandler(svc *service.TodayService) *TodayHandler {
	return &TodayHandler{svc: svc}
}

func (h *TodayHandler) GetToday(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	result, err := h.svc.GetToday(r.Context(), user)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}

	httputil.OK(w, result)
}

func (h *TodayHandler) GetLongread(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	if !domain.IsPro(user) {
		httputil.Error(w, http.StatusForbidden, httputil.CodeProRequired, "Нужна Pro подписка")
		return
	}

	// TODO: implement longread content
	httputil.OK(w, map[string]string{"longread": "coming soon"})
}
