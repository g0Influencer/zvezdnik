package domain

import "errors"

var (
	ErrUserNotFound              = errors.New("user not found")
	ErrNatalChartNotFound        = errors.New("natal chart not found")
	ErrOnboardingIncomplete      = errors.New("onboarding not completed")
	ErrProRequired               = errors.New("pro subscription required")
	ErrChatLimitExceeded         = errors.New("daily chat limit exceeded")
	ErrPaymentNotFound           = errors.New("payment not found")
	ErrCompatibilityCardNotFound = errors.New("compatibility card not found")
	ErrCompatibilityNoCredits    = errors.New("compatibility credits exhausted")
	ErrVoidEntryNotFound         = errors.New("void entry not found")
	ErrVoidNoCredits             = errors.New("void credits exhausted")
)
