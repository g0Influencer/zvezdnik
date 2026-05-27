// Package content fetches collaborator-managed CMS content from a public
// Google Sheet (the same source the frontend uses). Used by the push
// scheduler so notifications carry the day's actual title.
package content

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DailyTip is a single row from the daily_tips sheet, minimal fields needed
// for a push notification.
type DailyTip struct {
	Date         string
	SoftTitle    string
	DirectTitle  string
	IsActive     bool
}

// PickTitle returns the title for the given user style. Falls back across
// styles, then to a generic phrase if both are empty.
func (t DailyTip) PickTitle(style string) string {
	if style == "blunt" && t.DirectTitle != "" {
		return t.DirectTitle
	}
	if t.SoftTitle != "" {
		return t.SoftTitle
	}
	if t.DirectTitle != "" {
		return t.DirectTitle
	}
	return ""
}

// DailyTipsClient fetches daily_tips rows from a public Google Sheet CSV.
type DailyTipsClient struct {
	spreadsheetID string
	httpClient    *http.Client
}

func NewDailyTipsClient(spreadsheetID string) *DailyTipsClient {
	return &DailyTipsClient{
		spreadsheetID: spreadsheetID,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

// LoadForDate returns the active row matching dateISO (YYYY-MM-DD), or the
// nearest prior active row. Returns nil if nothing matches.
func (c *DailyTipsClient) LoadForDate(ctx context.Context, dateISO string) (*DailyTip, error) {
	rows, err := c.fetch(ctx)
	if err != nil {
		return nil, err
	}

	active := make([]DailyTip, 0, len(rows))
	for _, r := range rows {
		if r.IsActive && r.Date != "" {
			active = append(active, r)
		}
	}
	if len(active) == 0 {
		return nil, nil
	}

	for i := range active {
		if active[i].Date == dateISO {
			return &active[i], nil
		}
	}

	// Nearest prior date (YYYY-MM-DD sorts lexically).
	var best *DailyTip
	for i := range active {
		if active[i].Date <= dateISO {
			if best == nil || active[i].Date > best.Date {
				best = &active[i]
			}
		}
	}
	return best, nil
}

func (c *DailyTipsClient) fetch(ctx context.Context) ([]DailyTip, error) {
	u := fmt.Sprintf(
		"https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&sheet=%s",
		url.PathEscape(c.spreadsheetID),
		url.QueryEscape("daily_tips"),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, fmt.Errorf("daily_tips: build request: %w", err)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("daily_tips: fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("daily_tips: status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("daily_tips: read body: %w", err)
	}
	if strings.HasPrefix(strings.TrimSpace(strings.ToLower(string(body))), "<") {
		return nil, fmt.Errorf("daily_tips: sheet not published (got HTML)")
	}

	r := csv.NewReader(strings.NewReader(string(body)))
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("daily_tips: parse csv: %w", err)
	}
	if len(records) < 2 {
		return nil, nil
	}

	header := records[0]
	idx := make(map[string]int, len(header))
	for i, h := range header {
		idx[strings.TrimSpace(h)] = i
	}
	get := func(row []string, key string) string {
		i, ok := idx[key]
		if !ok || i >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[i])
	}

	tips := make([]DailyTip, 0, len(records)-1)
	for _, row := range records[1:] {
		if len(row) == 0 {
			continue
		}
		tips = append(tips, DailyTip{
			Date:        get(row, "date"),
			SoftTitle:   get(row, "soft_title"),
			DirectTitle: get(row, "direct_title"),
			IsActive:    isActive(get(row, "is_active")),
		})
	}
	return tips, nil
}

func isActive(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "", "true", "1", "yes", "да", "y", "on":
		return true
	}
	return false
}
