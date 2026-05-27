package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"zvezdnik/internal/api/middleware"
	"zvezdnik/internal/db"
	"zvezdnik/internal/domain"
	"zvezdnik/internal/httputil"
	"zvezdnik/internal/llm"
)

type ProfileHandler struct {
	queries *db.Queries
}

func NewProfileHandler(queries *db.Queries) *ProfileHandler {
	return &ProfileHandler{queries: queries}
}

type profileUpdateRequest struct {
	Style           *string          `json:"style,omitempty"`
	Focus           *string          `json:"focus,omitempty"`
	DisplayName     *string          `json:"display_name,omitempty"`
	ProStatus       *string          `json:"pro_status,omitempty"`
	Personalization *json.RawMessage `json:"personalization,omitempty"`
	PushEnabled     *bool            `json:"push_enabled,omitempty"`
}

func (h *ProfileHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	profile, err := h.buildProfile(r.Context(), user)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}
	httputil.OK(w, profile)
}

func (h *ProfileHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUser(r.Context())
	if user == nil {
		httputil.Error(w, http.StatusUnauthorized, httputil.CodeOnboardingRequired, "Необходимо пройти онбординг")
		return
	}

	var req profileUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный формат запроса")
		return
	}

	if req.Style != nil {
		if err := h.queries.UpdateUserStyle(r.Context(), db.UpdateUserStyleParams{
			ID: user.ID, Style: *req.Style,
		}); err != nil {
			httputil.InternalError(w, err)
			return
		}
	}

	if req.Focus != nil {
		if err := h.queries.UpdateUserFocus(r.Context(), db.UpdateUserFocusParams{
			ID: user.ID, Focus: *req.Focus,
		}); err != nil {
			httputil.InternalError(w, err)
			return
		}
	}

	if req.DisplayName != nil {
		if err := h.queries.UpdateUserDisplayName(r.Context(), db.UpdateUserDisplayNameParams{
			ID: user.ID, DisplayName: req.DisplayName,
		}); err != nil {
			httputil.InternalError(w, err)
			return
		}
	}

	if req.ProStatus != nil {
		switch *req.ProStatus {
		case domain.ProStatusActive:
			if _, err := h.queries.ActivatePro(r.Context(), user.ID); err != nil {
				httputil.InternalError(w, err)
				return
			}
		case domain.ProStatusFree:
			if err := h.queries.CancelPro(r.Context(), user.ID); err != nil {
				httputil.InternalError(w, err)
				return
			}
		default:
			httputil.Error(w, http.StatusBadRequest, httputil.CodeInvalidRequest, "Неверный pro_status")
			return
		}
	}

	if req.Personalization != nil {
		if err := h.queries.UpdateUserPersonalization(r.Context(), db.UpdateUserPersonalizationParams{
			ID:              user.ID,
			Personalization: []byte(*req.Personalization),
		}); err != nil {
			httputil.InternalError(w, err)
			return
		}
	}

	if req.PushEnabled != nil {
		if err := h.queries.UpdateUserPushEnabled(r.Context(), db.UpdateUserPushEnabledParams{
			ID:          user.ID,
			PushEnabled: *req.PushEnabled,
		}); err != nil {
			httputil.InternalError(w, err)
			return
		}
	}

	updated, err := h.queries.GetUserByID(r.Context(), user.ID)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}
	profile, err := h.buildProfile(r.Context(), &updated)
	if err != nil {
		httputil.InternalError(w, err)
		return
	}
	httputil.OK(w, map[string]interface{}{"user": profile})
}

// buildProfile assembles the API-facing profile payload from a user row +
// natal chart (if any).
func (h *ProfileHandler) buildProfile(ctx context.Context, user *domain.User) (map[string]interface{}, error) {
	nc, err := h.queries.GetNatalChartByUserID(ctx, user.ID)
	hasChart := err == nil
	if err != nil && !db.IsNotFound(err) && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	sunSign := ""
	ascSign := ""
	if hasChart {
		ascSign = llm.SignToRu(nc.AscendantSign)
		var planets map[string]struct {
			Sign string `json:"sign"`
		}
		_ = json.Unmarshal(nc.Planets, &planets)
		if sun, ok := planets["Sun"]; ok {
			sunSign = llm.SignToRu(sun.Sign)
		}
	}

	displayName := ""
	if user.DisplayName != nil {
		displayName = *user.DisplayName
	}

	return map[string]interface{}{
		"display_name":     displayName,
		"sun_sign":         sunSign,
		"ascendant_sign":   ascSign,
		"birth_date":       user.BirthDate.Format("2006-01-02"),
		"birth_place":      user.BirthPlace,
		"gender":           user.Gender,
		"style":            user.Style,
		"focus":            user.Focus,
		"personalization":  json.RawMessage(user.Personalization),
		"pro_status":       user.ProStatus,
		"pro_activated_at": user.ProActivatedAt,
		"trial_ends_at":    user.TrialEndsAt,
		"push_enabled":     user.PushEnabled,
	}, nil
}
