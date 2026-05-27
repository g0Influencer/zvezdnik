package middleware

import (
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"

	"zvezdnik/internal/httputil"
)

func RateLimit(rdb *redis.Client, limit int, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := r.RemoteAddr
			if forwarded := r.Header.Get("X-Real-IP"); forwarded != "" {
				ip = forwarded
			}

			key := fmt.Sprintf("rate_limit:%s", ip)
			count, err := rdb.Incr(r.Context(), key).Result()
			if err != nil {
				// If Redis is down, allow the request
				next.ServeHTTP(w, r)
				return
			}

			if count == 1 {
				rdb.Expire(r.Context(), key, window)
			}

			if count > int64(limit) {
				httputil.Error(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED", "Слишком много запросов")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
