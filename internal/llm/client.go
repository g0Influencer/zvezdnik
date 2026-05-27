package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"zvezdnik/internal/domain"
)

const yandexCompletionURL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"

type Client struct {
	apiKey   string
	folderID string
	model    string
	http     *http.Client
}

func NewClient(apiKey, folderID string) *Client {
	return &Client{
		apiKey:   apiKey,
		folderID: folderID,
		model:    "yandexgpt/latest",
		http:     &http.Client{},
	}
}

type completionRequest struct {
	ModelURI          string              `json:"modelUri"`
	CompletionOptions completionOptions   `json:"completionOptions"`
	JSONObject        bool                `json:"jsonObject,omitempty"`
	Messages          []completionMessage `json:"messages"`
}

type completionOptions struct {
	Stream      bool    `json:"stream"`
	Temperature float64 `json:"temperature"`
	MaxTokens   string  `json:"maxTokens"`
}

type completionMessage struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

type completionResponse struct {
	Result struct {
		Alternatives []struct {
			Message struct {
				Text string `json:"text"`
			} `json:"message"`
		} `json:"alternatives"`
	} `json:"result"`
}

func (c *Client) generate(ctx context.Context, systemPrompt, userPrompt string, maxTokens int, temperature float64, jsonObject bool) (string, error) {
	var messages []completionMessage
	if systemPrompt != "" {
		messages = append(messages, completionMessage{Role: "system", Text: systemPrompt})
	}
	messages = append(messages, completionMessage{Role: "user", Text: userPrompt})

	reqBody := completionRequest{
		ModelURI:   fmt.Sprintf("gpt://%s/%s", c.folderID, c.model),
		JSONObject: jsonObject,
		CompletionOptions: completionOptions{
			Stream:      false,
			Temperature: temperature,
			MaxTokens:   fmt.Sprintf("%d", maxTokens),
		},
		Messages: messages,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", yandexCompletionURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Api-Key "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("yandex gpt: status=%d body=%s", resp.StatusCode, string(respBody))
	}

	var cr completionResponse
	if err := json.Unmarshal(respBody, &cr); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}

	if len(cr.Result.Alternatives) == 0 {
		return "", fmt.Errorf("yandex gpt: no alternatives in response")
	}

	return cr.Result.Alternatives[0].Message.Text, nil
}

func stripJSONFences(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

func (c *Client) GeneratePortrait(ctx context.Context, chart *domain.NatalChart, tone string) (string, error) {
	prompt := buildPortraitPrompt(chart, tone)
	text, err := c.generate(ctx, "", prompt, 2048, 0.8, false)
	if err != nil {
		return "", fmt.Errorf("llm generate portrait: %w", err)
	}
	return text, nil
}

func (c *Client) GenerateDailyContent(ctx context.Context, p domain.DailyContentParams) (*domain.DailySlot, error) {
	prompt := buildDailyPrompt(p)
	text, err := c.generate(ctx, "", prompt, 1024, 0.8, true)
	if err != nil {
		return nil, fmt.Errorf("llm generate daily: %w", err)
	}

	text = stripJSONFences(text)

	var slot domain.DailySlot
	if err := json.Unmarshal([]byte(text), &slot); err != nil {
		return nil, fmt.Errorf("llm parse daily json: %w (raw: %s)", err, text[:min(len(text), 200)])
	}
	return &slot, nil
}

