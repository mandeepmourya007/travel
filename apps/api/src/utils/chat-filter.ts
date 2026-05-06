const REDACTED_PLACEHOLDER = '[contact info hidden]'

const PHONE_REGEX = /(\+91[\s-]?)?[6-9]\d{9}/g
const UPI_REGEX = /[\w.-]+@(ybl|okhdfcbank|okicici|oksbi|paytm|apl|axisbank|ibl|upi|kotak|federal|icici|hdfcbank|sbi|axl|indus)/gi
const INSTAGRAM_REGEX = /@[\w.]{1,30}/g
const WHATSAPP_REGEX = /wa\.me\/\d+/gi
const EMAIL_REGEX = /[\w.-]+@[\w.-]+\.\w{2,}/gi
const URL_REGEX = /(https?:\/\/)?[\w.-]+\.(com|in|org|io|me|net|co)(\/\S*)?/gi

export interface ChatFilterResult {
  filtered: string
  isFlagged: boolean
  originalContent: string | null
}

export function filterChatMessage(content: string): ChatFilterResult {
  const original = content
  let filtered = content
  let isFlagged = false

  const patterns = [
    PHONE_REGEX,
    UPI_REGEX,
    WHATSAPP_REGEX,
    EMAIL_REGEX,
    URL_REGEX,
    INSTAGRAM_REGEX,
  ]

  for (const pattern of patterns) {
    pattern.lastIndex = 0
    if (pattern.test(filtered)) {
      isFlagged = true
      pattern.lastIndex = 0
      filtered = filtered.replace(pattern, REDACTED_PLACEHOLDER)
    }
  }

  return {
    filtered,
    isFlagged,
    originalContent: isFlagged ? original : null,
  }
}
