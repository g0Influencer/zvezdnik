package httputil

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

const (
	CodeUserNotFound       = "USER_NOT_FOUND"
	CodeOnboardingRequired = "ONBOARDING_REQUIRED"
	CodeProRequired        = "PRO_REQUIRED"
	CodeChatLimitExceeded  = "CHAT_LIMIT_EXCEEDED"
	CodeInternalError      = "INTERNAL_ERROR"
	CodeInvalidRequest     = "INVALID_REQUEST"
	CodeUnauthorized       = "UNAUTHORIZED"
)

type successResponse struct {
	Data interface{} `json:"data"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type errorResponse struct {
	Error errorBody `json:"error"`
}

func OK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(successResponse{Data: data})
}

func Error(w http.ResponseWriter, status int, code string, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(errorResponse{
		Error: errorBody{Code: code, Message: msg},
	})
}

func InternalError(w http.ResponseWriter, err error) {
	slog.Error("internal error", "error", err)
	Error(w, http.StatusInternalServerError, CodeInternalError, "Внутренняя ошибка сервера")
}
