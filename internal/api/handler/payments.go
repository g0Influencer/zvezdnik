package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"

	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/httputil"
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

// Webhook handles Robokassa's ResultURL (configured in the cabinet). Robokassa
// may call it via GET or POST, so we read the merged form. On success we MUST
// reply with the exact body "OK<InvId>" or Robokassa keeps retrying.
func (h *PaymentsHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	invID, err := h.svc.HandleWebhook(r.Context(), r.Form)
	if err != nil {
		// Non-"OK" response signals failure; Robokassa will retry later.
		slog.Error("payments: webhook failed", "error", err, "inv_id", invID)
		http.Error(w, "payment processing failed", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprintf(w, "OK%d", invID)
}
