package i18n

import (
	"net/http"
	"strings"
)

// Notification message templates by language
// Uses {{actor}} and {{entityType}} as placeholders
var notificationMessages = map[string]map[string]string{
	"en": {
		"mention":             "{{actor}} mentioned you",
		"mention_everyone":    "{{actor}} mentioned everyone",
		"assigned":            "{{actor}} assigned you",
		"comment_on_owned":    "{{actor}} commented on your {{entityType}}",
		"comment_on_assigned": "{{actor}} commented",
		"entity_updated":      "{{actor}} updated your {{entityType}}",
		"entity_deleted":      "{{actor}} deleted your {{entityType}}",
		"reaction":            "{{actor}} reacted with {{emoji}}",
	},
	"ar": {
		"mention":             "{{actor}} أشار إليك",
		"mention_everyone":    "{{actor}} أشار إلى الجميع",
		"assigned":            "{{actor}} أسند إليك",
		"comment_on_owned":    "{{actor}} علّق على {{entityType}} الخاص بك",
		"comment_on_assigned": "{{actor}} علّق",
		"entity_updated":      "{{actor}} حدّث {{entityType}} الخاص بك",
		"entity_deleted":      "{{actor}} حذف {{entityType}} الخاص بك",
		"reaction":            "{{actor}} تفاعل بـ {{emoji}}",
	},
}

// Telegram-specific strings
var telegramStrings = map[string]map[string]string{
	"en": {
		"open_link": "Open in Sarray Forge",
	},
	"ar": {
		"open_link": "فتح في سراي فورج",
	},
}

// GetTelegramString returns a localized string for Telegram messages
func GetTelegramString(lang, key string) string {
	langMap, ok := telegramStrings[lang]
	if !ok {
		langMap = telegramStrings["en"]
	}
	if str, ok := langMap[key]; ok {
		return str
	}
	return key
}

// Entity type translations
var entityTypes = map[string]map[string]string{
	"en": {"issue": "issue", "doc": "document", "release": "release"},
	"ar": {"issue": "المهمة", "doc": "الوثيقة", "release": "الإصدار"},
}

// GetNotificationMessage builds a localized notification message
func GetNotificationMessage(lang, notifType, actorName, entityType string) string {
	return GetNotificationMessageWithEmoji(lang, notifType, actorName, entityType, "")
}

// GetNotificationMessageWithEmoji builds a localized notification message with optional emoji
func GetNotificationMessageWithEmoji(lang, notifType, actorName, entityType, emoji string) string {
	// Get language map, fallback to English
	langMap, ok := notificationMessages[lang]
	if !ok {
		langMap = notificationMessages["en"]
	}

	// Get message template
	template, ok := langMap[notifType]
	if !ok {
		return actorName // fallback to just actor name
	}

	// Replace {{actor}} placeholder
	msg := strings.Replace(template, "{{actor}}", actorName, 1)

	// Replace {{entityType}} placeholder if present
	if strings.Contains(msg, "{{entityType}}") {
		entityLangMap := entityTypes[lang]
		if entityLangMap == nil {
			entityLangMap = entityTypes["en"]
		}
		entityName := entityLangMap[entityType]
		if entityName == "" {
			entityName = entityType // fallback to raw type
		}
		msg = strings.Replace(msg, "{{entityType}}", entityName, 1)
	}

	// Replace {{emoji}} placeholder if present
	if strings.Contains(msg, "{{emoji}}") && emoji != "" {
		msg = strings.Replace(msg, "{{emoji}}", emoji, 1)
	}

	return msg
}

// GetLanguageFromRequest extracts the language preference from the Accept-Language header
// Returns "en" as default if not specified or not supported
func GetLanguageFromRequest(r *http.Request) string {
	lang := r.Header.Get("Accept-Language")

	// Normalize: handle "ar-SA", "ar", "en-US", "en", etc.
	lang = strings.ToLower(strings.TrimSpace(lang))

	// Check for Arabic
	if strings.HasPrefix(lang, "ar") {
		return "ar"
	}

	// Default to English
	return "en"
}
