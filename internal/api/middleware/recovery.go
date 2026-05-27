package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"

	"zvezdnik/internal/httputil"
)

func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				reqID := GetRequestID(r.Context())
				slog.Error("panic recovered",
					"request_id", reqID,
					"panic", rec,
					"stack", string(debug.Stack()),
				)
				httputil.Error(w, http.StatusInternalServerError, httputil.CodeInternalError, "Внутренняя ошибка сервера")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
