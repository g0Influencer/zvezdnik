package handler

import (
	"errors"
	"net/http"

	"zvezdnik/internal/httputil"
	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/service"
)

type ChartHandler struct {
	svc *service.ChartService
}

func NewChartHandler(svc *service.ChartService) *ChartHandler {
	return &ChartHandler{svc: svc}
}

func (h *ChartHandler) GetChart(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	result, err := h.svc.GetChart(r.Context(), user.ID)
	switch {
	case errors.Is(err, domain.ErrNatalChartNotFound):
		httputil.Error(w, http.StatusNotFound, httputil.CodeOnboardingRequired, "Натальная карта не найдена")
	case err != nil:
		httputil.InternalError(w, err)
	default:
		httputil.OK(w, result)
	}
}
