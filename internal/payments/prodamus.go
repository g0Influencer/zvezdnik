// Package payments implements Prodamus (payform.ru) payment-link generation
// and webhook signature verification.
//
// Sign algorithm: drop the "sign" key, JSON-encode the rest with recursively
// sorted map keys and unescaped Unicode, then HMAC-SHA256 with the shop's
// secret as the key. Go's encoding/json already sorts map keys alphabetically
// and leaves non-ASCII runes intact, so json.Marshal is the canonical form.
package payments

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
)

type Product struct {
	Name     string
	Price    string // rubles, e.g. "299" or "299.00"
	Quantity int
	SKU      string
}

type PaymentRequest struct {
	OrderID        string // our subscription id
	OrderNum       string // user-facing number (often same as OrderID)
	CustomerExtra  string // free-form, we put "user_id=N"
	CustomerEmail  string
	CustomerPhone  string
	Products       []Product
	SuccessURL     string
	NotificationURL string
}

// BuildPaymentURL returns the signed payment URL the client should be
// redirected to. shopURL is the per-merchant base, e.g.
// "https://zvezdnik.payform.ru".
func BuildPaymentURL(shopURL, secret string, req PaymentRequest) (string, error) {
	if shopURL == "" {
		return "", fmt.Errorf("prodamus: shop url is empty")
	}
	if secret == "" {
		return "", fmt.Errorf("prodamus: secret key is empty")
	}

	params := map[string]any{
		"do":       "link",
		"order_id": req.OrderID,
	}
	if req.OrderNum != "" {
		params["order_num"] = req.OrderNum
	}
	if req.CustomerEmail != "" {
		params["customer_email"] = req.CustomerEmail
	}
	if req.CustomerPhone != "" {
		params["customer_phone"] = req.CustomerPhone
	}
	if req.CustomerExtra != "" {
		params["customer_extra"] = req.CustomerExtra
	}
	if req.SuccessURL != "" {
		params["urlSuccess"] = req.SuccessURL
	}
	if req.NotificationURL != "" {
		params["urlNotification"] = req.NotificationURL
	}
	if len(req.Products) > 0 {
		ps := make([]map[string]any, 0, len(req.Products))
		for _, p := range req.Products {
			row := map[string]any{
				"name":     p.Name,
				"price":    p.Price,
				"quantity": strconv.Itoa(p.Quantity),
			}
			if p.SKU != "" {
				row["sku"] = p.SKU
			}
			ps = append(ps, row)
		}
		params["products"] = ps
	}

	sign, err := Sign(params, secret)
	if err != nil {
		return "", err
	}

	u, err := url.Parse(shopURL)
	if err != nil {
		return "", fmt.Errorf("prodamus: parse shop url: %w", err)
	}
	q := u.Query()
	flatten("", params, q)
	q.Set("sign", sign)
	u.RawQuery = q.Encode()
	return u.String(), nil
}

// Sign computes the HMAC-SHA256 (hex) of the canonical JSON of params minus
// the "sign" key. Exported for tests + webhook verification.
func Sign(params map[string]any, secret string) (string, error) {
	clean := stripSign(params)
	body, err := json.Marshal(clean)
	if err != nil {
		return "", fmt.Errorf("prodamus: marshal params: %w", err)
	}
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	return hex.EncodeToString(h.Sum(nil)), nil
}

// VerifyWebhook checks the signature on a Prodamus notification. The body is
// the raw POST body (form-urlencoded). Returns the parsed values on success.
func VerifyWebhook(secret string, body []byte) (url.Values, error) {
	if secret == "" {
		return nil, fmt.Errorf("prodamus: secret key is empty")
	}
	values, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, fmt.Errorf("prodamus: parse webhook body: %w", err)
	}
	got := values.Get("sign")
	if got == "" {
		return nil, fmt.Errorf("prodamus: missing sign")
	}

	params := unflatten(values)
	want, err := Sign(params, secret)
	if err != nil {
		return nil, err
	}
	if subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
		return nil, fmt.Errorf("prodamus: signature mismatch")
	}
	return values, nil
}

func stripSign(in map[string]any) map[string]any {
	out := make(map[string]any, len(in))
	for k, v := range in {
		if k == "sign" {
			continue
		}
		out[k] = v
	}
	return out
}

// flatten serializes nested maps/arrays to the PHP-style bracket form used by
// http_build_query, e.g. products[0][name]=Foo, then writes them into vals.
func flatten(prefix string, v any, out url.Values) {
	switch t := v.(type) {
	case map[string]any:
		for k, val := range t {
			key := k
			if prefix != "" {
				key = prefix + "[" + k + "]"
			}
			flatten(key, val, out)
		}
	case []map[string]any:
		for i, row := range t {
			flatten(prefix+"["+strconv.Itoa(i)+"]", row, out)
		}
	default:
		out.Set(prefix, fmt.Sprint(v))
	}
}

// unflatten reconstructs the nested structure Prodamus signed on its side
// from bracket-keyed form values. Maps whose keys are exactly 0..N-1 are
// converted to slices so JSON encoding emits an array — that's the shape
// Prodamus hashes when computing the sign, so we must match it to verify.
func unflatten(vals url.Values) map[string]any {
	out := make(map[string]any)
	for key, list := range vals {
		if key == "sign" {
			continue
		}
		val := ""
		if len(list) > 0 {
			val = list[0]
		}
		assign(out, parseKey(key), val)
	}
	collapsed := collapseArrays(out)
	if m, ok := collapsed.(map[string]any); ok {
		return m
	}
	return out
}

func collapseArrays(v any) any {
	m, ok := v.(map[string]any)
	if !ok {
		return v
	}
	for k, child := range m {
		m[k] = collapseArrays(child)
	}
	if arr, ok := tryToArray(m); ok {
		return arr
	}
	return m
}

func tryToArray(m map[string]any) ([]any, bool) {
	n := len(m)
	if n == 0 {
		return nil, false
	}
	out := make([]any, n)
	for i := 0; i < n; i++ {
		v, ok := m[strconv.Itoa(i)]
		if !ok {
			return nil, false
		}
		out[i] = v
	}
	return out, true
}

// parseKey turns "products[0][name]" into ["products", "0", "name"].
func parseKey(key string) []string {
	parts := []string{}
	cur := ""
	inBracket := false
	for i := 0; i < len(key); i++ {
		ch := key[i]
		switch ch {
		case '[':
			if !inBracket {
				if cur != "" {
					parts = append(parts, cur)
					cur = ""
				}
				inBracket = true
			}
		case ']':
			if inBracket {
				parts = append(parts, cur)
				cur = ""
				inBracket = false
			}
		default:
			cur += string(ch)
		}
	}
	if cur != "" {
		parts = append(parts, cur)
	}
	return parts
}

func assign(root map[string]any, path []string, val string) {
	if len(path) == 0 {
		return
	}
	if len(path) == 1 {
		root[path[0]] = val
		return
	}
	head, rest := path[0], path[1:]
	existing, ok := root[head]
	if !ok {
		nm := make(map[string]any)
		root[head] = nm
		assign(nm, rest, val)
		return
	}
	if nm, ok := existing.(map[string]any); ok {
		assign(nm, rest, val)
	}
}
