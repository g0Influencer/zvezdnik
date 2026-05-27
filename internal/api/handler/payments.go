package handler

import (
	"encoding/json"
	"io"
	"net/http"

	"zvezdnik/internal/httputil"
	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/service"
)

type PaymentsHandler struct {
	svc *service.PaymentsService
}

func NewPaymentsHandler(svc *service.PaymentsService) *PaymentsHandler {
	return &PaymentsHandler{svc: svc}
}

func (h *PaymentsHandler) Create(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	var req service.PaymentCreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный формат запроса")
		return
	}

	result, err := h.svc.CreatePayment(r.Context(), user.ID, req)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}

	httputil.OK(w, result)
}

func (h *PaymentsHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}

	if err := h.svc.HandleWebhook(r.Context(), body); err != nil {
		httputil.InternalError(w, err)
		return
	}

	w.WriteHeader(http.StatusOK)
}
