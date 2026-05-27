package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/httputil"
	"zvezdnik/internal/service"
)

type CompatibilityHandler struct {
	svc *service.CompatibilityService
}

func NewCompatibilityHandler(svc *service.CompatibilityService) *CompatibilityHandler {
	return &CompatibilityHandler{svc: svc}
}

func (h *CompatibilityHandler) GetCredits(w http.ResponseWriter, r *http.Request) {
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

func (h *CompatibilityHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
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

func (h *CompatibilityHandler) GetCard(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	cardID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный id")
		return
	}

	card, err := h.svc.Get(r.Context(), user, cardID)
	switch {
	case errors.Is(err, domain.ErrCompatibilityCardNotFound):
		httputil.Error(w, http.StatusNotFound, httputil.CodeInvalidRequest, "Карта не найдена")
	case err != nil:
		httputil.InternalError(w, err)
	default:
		httputil.OK(w, card)
	}
}

type generateCompatibilityRequest struct {
	OtherBirthDate  string  `json:"other_birth_date"`
	OtherBirthTime  *string `json:"other_birth_time"`
	OtherBirthPlace *string `json:"other_birth_place"`
	OtherGender     string  `json:"other_gender"`
	IncludeLove     bool    `json:"include_love"`
}

func (h *CompatibilityHandler) Generate(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	var req generateCompatibilityRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный формат запроса")
		return
	}

	birthDate, err := time.Parse("2006-01-02", req.OtherBirthDate)
	if err != nil {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверная дата рождения")
		return
	}

	if req.OtherGender != domain.GenderMale && req.OtherGender != domain.GenderFemale {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный пол")
		return
	}

	result, err := h.svc.Generate(r.Context(), user, service.GenerateCompatibilityInput{
		OtherBirthDate:  birthDate,
		OtherBirthTime:  req.OtherBirthTime,
		OtherBirthPlace: req.OtherBirthPlace,
		OtherGender:     req.OtherGender,
		IncludeLove:     req.IncludeLove,
	})
	switch {
	case errors.Is(err, domain.ErrProRequired):
		httputil.Error(w, http.StatusForbidden, httputil.CodeProRequired, "Нужна Pro подписка")
	case errors.Is(err, domain.ErrCompatibilityNoCredits):
		httputil.Error(w, http.StatusForbidden, httputil.CodeProRequired, "Лимит на этот месяц исчерпан")
	case err != nil:
		httputil.InternalError(w, err)
	default:
		httputil.OK(w, result)
	}
}
