package payments

import (
	"crypto/md5"
	"encoding/hex"
	"net/url"
	"strings"
	"testing"
)

func testClient() *Client {
	return NewClient(Config{
		MerchantLogin: "demo",
		Password1:     "pass1",
		Password2:     "pass2",
		HashAlgo:      "md5",
	})
}

func md5hex(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])
}

func TestPaymentURLSignature(t *testing.T) {
	c := testClient()
	u, err := c.PaymentURL(Invoice{InvID: 42, AmountRub: 299, Description: "PRO", UserID: 7})
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(u)
	if err != nil {
		t.Fatal(err)
	}
	q := parsed.Query()

	if got := q.Get("OutSum"); got != "299.00" {
		t.Fatalf("OutSum = %q, want 299.00", got)
	}
	if got := q.Get("InvId"); got != "42" {
		t.Fatalf("InvId = %q, want 42", got)
	}
	if got := q.Get("Shp_userId"); got != "7" {
		t.Fatalf("Shp_userId = %q, want 7", got)
	}
	want := md5hex("demo:299.00:42:pass1:Shp_userId=7")
	if got := q.Get("SignatureValue"); got != want {
		t.Fatalf("SignatureValue = %q, want %q", got, want)
	}
}

func TestVerifyResult(t *testing.T) {
	c := testClient()
	sig := md5hex("299.00:42:pass2:Shp_userId=7")
	vals := url.Values{
		"OutSum":         {"299.00"},
		"InvId":          {"42"},
		"Shp_userId":     {"7"},
		"SignatureValue": {strings.ToUpper(sig)}, // Robokassa sends upper-case hex
	}
	res, err := c.VerifyResult(vals)
	if err != nil {
		t.Fatalf("verify failed: %v", err)
	}
	if res.InvID != 42 || res.UserID != 7 {
		t.Fatalf("parsed InvID=%d UserID=%d, want 42/7", res.InvID, res.UserID)
	}
}

func TestVerifyResultRejectsTampered(t *testing.T) {
	c := testClient()
	sig := md5hex("299.00:42:pass2:Shp_userId=7")
	vals := url.Values{
		"OutSum":         {"299.00"},
		"InvId":          {"999"}, // amount/order swapped after signing
		"Shp_userId":     {"7"},
		"SignatureValue": {sig},
	}
	if _, err := c.VerifyResult(vals); err == nil {
		t.Fatal("expected signature mismatch, got nil")
	}
}

func TestReceiptEmbedding(t *testing.T) {
	c := NewClient(Config{MerchantLogin: "demo", Password1: "pass1", Password2: "pass2", Fiscal: true})
	inv := Invoice{InvID: 42, AmountRub: 299, UserID: 7, Items: []ReceiptItem{{Name: "PRO", Quantity: 1, SumRub: 299}}}
	u, err := c.PaymentURL(inv)
	if err != nil {
		t.Fatal(err)
	}

	rj, _ := buildReceiptJSON(inv.Items)
	receiptEnc := url.QueryEscape(rj)

	// The Receipt must be present single-encoded (not re-escaped by url.Values).
	if !strings.Contains(u, "&Receipt="+receiptEnc) {
		t.Fatalf("URL missing single-encoded Receipt\nurl: %s", u)
	}
	// ...and that exact encoded string must be the one folded into the signature.
	want := md5hex("demo:299.00:42:" + receiptEnc + ":pass1:Shp_userId=7")
	parsed, _ := url.Parse(u)
	if got := parsed.Query().Get("SignatureValue"); got != want {
		t.Fatalf("SignatureValue = %q, want %q", got, want)
	}
}
