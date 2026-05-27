package payments

import (
	"net/url"
	"strings"
	"testing"
)

const testSecret = "test-secret-key"

func TestSignDeterministic(t *testing.T) {
	params := map[string]any{
		"order_id": "42",
		"products": []map[string]any{
			{"name": "Звёздник PRO", "price": "299", "quantity": "1"},
		},
	}
	s1, err := Sign(params, testSecret)
	if err != nil {
		t.Fatal(err)
	}
	s2, err := Sign(params, testSecret)
	if err != nil {
		t.Fatal(err)
	}
	if s1 != s2 || len(s1) != 64 {
		t.Fatalf("expected stable 64-char hex sign, got %q / %q", s1, s2)
	}
}

func TestBuildPaymentURLAndVerify(t *testing.T) {
	req := PaymentRequest{
		OrderID:       "42",
		OrderNum:      "42",
		CustomerExtra: "user_id=7",
		Products: []Product{
			{Name: "Звёздник PRO", Price: "299", Quantity: 1},
		},
		NotificationURL: "https://example.com/payments/webhook",
	}
	u, err := BuildPaymentURL("https://demo.payform.ru", testSecret, req)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Host != "demo.payform.ru" {
		t.Fatalf("wrong host: %s", parsed.Host)
	}
	if parsed.Query().Get("sign") == "" {
		t.Fatal("missing sign in URL")
	}

	// Simulate Prodamus echoing the same params back to our webhook with a
	// matching sign — verify must accept it.
	body := strings.TrimPrefix(parsed.RawQuery, "")
	values, err := VerifyWebhook(testSecret, []byte(body))
	if err != nil {
		t.Fatalf("verify failed on round-trip: %v", err)
	}
	if values.Get("order_id") != "42" {
		t.Fatalf("order_id lost in round-trip: %q", values.Get("order_id"))
	}
}

func TestVerifyWebhookRejectsTampered(t *testing.T) {
	req := PaymentRequest{
		OrderID:  "42",
		Products: []Product{{Name: "PRO", Price: "299", Quantity: 1}},
	}
	u, _ := BuildPaymentURL("https://demo.payform.ru", testSecret, req)
	parsed, _ := url.Parse(u)
	q := parsed.Query()
	q.Set("order_id", "999") // attacker swaps the order id
	parsed.RawQuery = q.Encode()

	if _, err := VerifyWebhook(testSecret, []byte(parsed.RawQuery)); err == nil {
		t.Fatal("expected signature mismatch, got nil")
	}
}
