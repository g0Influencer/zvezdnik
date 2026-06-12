// Package payments implements Robokassa payment links and ResultURL verification.
//
// Signature strings (colon-joined, hashed with the cabinet's algorithm, MD5 by
// default):
//
//	init     : MerchantLogin:OutSum:InvId[:Receipt]:Password#1[:Shp_k=v ...]
//	ResultURL: OutSum:InvId:Password#2[:Shp_k=v ...]
//
// Receipt is URL-encoded once; the same encoded string is signed and sent. Shp_
// params are appended after the password, sorted by key.
package payments

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"hash"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
)

const (
	indexURL     = "https://auth.robokassa.ru/Merchant/Index.aspx"
	recurringURL = "https://auth.robokassa.ru/Merchant/Recurring"
)

type Config struct {
	MerchantLogin string
	Password1     string // forms the init-payment signature
	Password2     string // verifies the ResultURL signature
	TestPassword1 string
	TestPassword2 string
	IsTest        bool
	HashAlgo      string // md5 (default) | sha256 | sha512 — must match the cabinet
	Fiscal        bool   // attach a Receipt (самозанятый: tax "none")
}

type Client struct {
	cfg Config
}

func NewClient(cfg Config) *Client {
	if cfg.HashAlgo == "" {
		cfg.HashAlgo = "md5"
	}
	return &Client{cfg: cfg}
}

// Configured reports whether the minimum credentials are present.
func (c *Client) Configured() bool {
	return c.cfg.MerchantLogin != "" && c.password1() != "" && c.password2() != ""
}

func (c *Client) password1() string {
	if c.cfg.IsTest {
		return c.cfg.TestPassword1
	}
	return c.cfg.Password1
}

func (c *Client) password2() string {
	if c.cfg.IsTest {
		return c.cfg.TestPassword2
	}
	return c.cfg.Password2
}

type ReceiptItem struct {
	Name     string
	Quantity int
	SumRub   float64
}

type Invoice struct {
	InvID       int64
	AmountRub   float64
	Description string
	UserID      int64 // becomes Shp_userId, echoed back on every ResultURL
	Recurring   bool  // first charge of a subscription (enrolls the card)
	Email       string
	Items       []ReceiptItem
}

// PaymentURL builds the signed redirect URL the client is sent to.
func (c *Client) PaymentURL(inv Invoice) (string, error) {
	if !c.Configured() {
		return "", fmt.Errorf("robokassa: not configured")
	}
	if inv.InvID <= 0 {
		return "", fmt.Errorf("robokassa: InvID must be positive, got %d", inv.InvID)
	}
	outSum := formatSum(inv.AmountRub)

	shp := map[string]string{}
	if inv.UserID > 0 {
		shp["Shp_userId"] = strconv.FormatInt(inv.UserID, 10)
	}

	parts := []string{c.cfg.MerchantLogin, outSum, strconv.FormatInt(inv.InvID, 10)}
	var receiptEnc string
	if c.cfg.Fiscal && len(inv.Items) > 0 {
		j, err := buildReceiptJSON(inv.Items)
		if err != nil {
			return "", err
		}
		receiptEnc = url.QueryEscape(j)
		parts = append(parts, receiptEnc)
	}
	parts = append(parts, c.password1())
	parts = append(parts, shpPairs(shp)...)
	sig := c.hash(strings.Join(parts, ":"))

	q := url.Values{}
	q.Set("MerchantLogin", c.cfg.MerchantLogin)
	q.Set("OutSum", outSum)
	q.Set("InvId", strconv.FormatInt(inv.InvID, 10))
	if inv.Description != "" {
		q.Set("Description", inv.Description)
	}
	q.Set("Encoding", "utf-8")
	q.Set("Culture", "ru")
	if inv.Email != "" {
		q.Set("Email", inv.Email)
	}
	if inv.Recurring {
		q.Set("Recurring", "true")
	}
	if c.cfg.IsTest {
		q.Set("IsTest", "1")
	}
	for k, v := range shp {
		q.Set(k, v)
	}
	q.Set("SignatureValue", sig)

	raw := q.Encode()
	if receiptEnc != "" {
		// Append the already-encoded Receipt verbatim so it matches what we signed.
		raw += "&Receipt=" + receiptEnc
	}
	return indexURL + "?" + raw, nil
}

type Result struct {
	InvID  int64
	OutSum string
	UserID int64 // from Shp_userId; 0 if absent
	Values url.Values
}

// VerifyResult checks the ResultURL signature (Password#2) and returns the parsed
// notification. values come from the merged GET+POST form.
func (c *Client) VerifyResult(values url.Values) (*Result, error) {
	if !c.Configured() {
		return nil, fmt.Errorf("robokassa: not configured")
	}
	got := strings.ToLower(values.Get("SignatureValue"))
	if got == "" {
		return nil, fmt.Errorf("robokassa: missing SignatureValue")
	}
	outSum := values.Get("OutSum")
	invIDStr := values.Get("InvId")

	shp := map[string]string{}
	for k := range values {
		if strings.HasPrefix(k, "Shp_") {
			shp[k] = values.Get(k)
		}
	}

	parts := append([]string{outSum, invIDStr, c.password2()}, shpPairs(shp)...)
	want := strings.ToLower(c.hash(strings.Join(parts, ":")))
	if subtle.ConstantTimeCompare([]byte(want), []byte(got)) != 1 {
		return nil, fmt.Errorf("robokassa: signature mismatch")
	}

	invID, err := strconv.ParseInt(invIDStr, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("robokassa: bad InvId %q: %w", invIDStr, err)
	}
	res := &Result{InvID: invID, OutSum: outSum, Values: values}
	if v := shp["Shp_userId"]; v != "" {
		res.UserID, _ = strconv.ParseInt(v, 10, 64)
	}
	return res, nil
}

// ChargeRecurring initiates a child (recurring) charge against a previously
// authorized "mother" payment referenced by motherInvID (PreviousInvoiceID).
// Signature is the standard init form over the CHILD InvId; PreviousInvoiceID is
// excluded from it, and Recurring/IncCurrLabel/ExpirationDate must not be sent.
// The final outcome arrives via ResultURL; an error here means the request was
// not accepted by Robokassa.
func (c *Client) ChargeRecurring(ctx context.Context, childInvID, motherInvID int64, amountRub float64, userID int64) error {
	if !c.Configured() {
		return fmt.Errorf("robokassa: not configured")
	}
	outSum := formatSum(amountRub)

	shp := map[string]string{}
	if userID > 0 {
		shp["Shp_userId"] = strconv.FormatInt(userID, 10)
	}
	parts := append([]string{c.cfg.MerchantLogin, outSum, strconv.FormatInt(childInvID, 10), c.password1()}, shpPairs(shp)...)
	sig := c.hash(strings.Join(parts, ":"))

	form := url.Values{}
	form.Set("MerchantLogin", c.cfg.MerchantLogin)
	form.Set("InvoiceID", strconv.FormatInt(childInvID, 10))
	form.Set("PreviousInvoiceID", strconv.FormatInt(motherInvID, 10))
	form.Set("OutSum", outSum)
	form.Set("Description", "Звёздник PRO — продление подписки")
	for k, v := range shp {
		form.Set(k, v)
	}
	form.Set("SignatureValue", sig)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, recurringURL, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("robokassa: build recurring request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("robokassa: recurring request: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("robokassa: recurring http %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

// shpPairs renders Shp_ params as "key=value" sorted by key — the form Robokassa
// appends to the signature.
func shpPairs(shp map[string]string) []string {
	keys := make([]string, 0, len(shp))
	for k := range shp {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := make([]string, 0, len(keys))
	for _, k := range keys {
		out = append(out, k+"="+shp[k])
	}
	return out
}

func (c *Client) hash(s string) string {
	var h hash.Hash
	switch strings.ToLower(c.cfg.HashAlgo) {
	case "sha256":
		h = sha256.New()
	case "sha512":
		h = sha512.New()
	default:
		h = md5.New()
	}
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

func formatSum(rub float64) string {
	return strconv.FormatFloat(rub, 'f', 2, 64)
}

// buildReceiptJSON builds the fiscal receipt. For самозанятый (НПД) every item is
// tax "none"; sno is omitted (taken from the cabinet).
func buildReceiptJSON(items []ReceiptItem) (string, error) {
	type receiptItem struct {
		Name          string  `json:"name"`
		Quantity      int     `json:"quantity"`
		Sum           float64 `json:"sum"`
		PaymentMethod string  `json:"payment_method"`
		PaymentObject string  `json:"payment_object"`
		Tax           string  `json:"tax"`
	}
	type receipt struct {
		Items []receiptItem `json:"items"`
	}
	r := receipt{}
	for _, it := range items {
		r.Items = append(r.Items, receiptItem{
			Name:          it.Name,
			Quantity:      it.Quantity,
			Sum:           it.SumRub,
			PaymentMethod: "full_payment",
			PaymentObject: "service",
			Tax:           "none",
		})
	}
	b, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("robokassa: marshal receipt: %w", err)
	}
	return string(b), nil
}
