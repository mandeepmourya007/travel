import { MSG91_WA_API_URL } from './whatsapp.constants'

export interface Msg91WhatsappRequestBody {
  integrated_number: string
  content_type: 'template'
  payload: {
    messaging_product: 'whatsapp'
    type: 'template'
    template: {
      name: string
      language: { code: string; policy: string }
      namespace: null
      to_and_components: [
        {
          to: [string]
          components: Record<string, { type: 'text'; value: string; subtype?: 'url' }>
        },
      ]
    }
  }
}

/** Outcome of a single MSG91 WhatsApp API call — transport-level only, no domain logging. */
export type Msg91SendResult =
  | { success: true }
  | { success: false; status?: number; errorBody?: string; networkError?: unknown }

/**
 * Builds the request body for MSG91's WhatsApp bulk outbound-message API.
 *
 * Shape confirmed from MSG91's dashboard "Code{JSON}" example and official docs
 * (msg91.com/help/whatsapp/whatsapp-otp, docs.msg91.com/whatsapp/template-bulk):
 * variables go in `to_and_components[].components`, keyed by position
 * (`body_1`, `body_2`, ...) — NOT the Meta Cloud API's array-based
 * `template.components` shape, which this endpoint does not accept.
 *
 * @param buttonUrlValue — WhatsApp Authentication templates ship with a "Copy
 * Code" URL button whose dynamic suffix parameter MSG91 requires separately
 * from the body variable (`button_1`, `subtype: 'url'`) — pass the OTP again
 * here for templates that include that button. Omit for plain templates.
 */
export function buildMsg91WhatsappBody(
  businessNumber: string,
  toPhone10Digit: string,
  templateName: string,
  values: unknown[],
  buttonUrlValue?: string,
): Msg91WhatsappRequestBody {
  const components: Record<string, { type: 'text'; value: string; subtype?: 'url' }> = {}
  values.forEach((v, i) => {
    components[`body_${i + 1}`] = { type: 'text', value: String(v ?? '') }
  })
  if (buttonUrlValue !== undefined) {
    components.button_1 = { type: 'text', subtype: 'url', value: buttonUrlValue }
  }

  return {
    // businessNumber is the exact WhatsApp-registered number shown on the MSG91
    // dashboard — already includes its own country code (e.g. Meta's test number
    // is a US-format "1555...", a real number would carry "91..."). Never re-prefix it.
    integrated_number: businessNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en', policy: 'deterministic' },
        namespace: null,
        to_and_components: [
          {
            to: [`91${toPhone10Digit}`],
            components,
          },
        ],
      },
    },
  }
}

/**
 * Sends a single WhatsApp template message via MSG91's bulk outbound-message API.
 *
 * Owns the entire transport concern (build body, POST, normalize the outcome) so
 * every caller — OTP delivery, transactional notifications, admin broadcasts —
 * shares one implementation instead of re-deriving the same fetch/error-handling
 * logic. Deliberately does NOT log: callers know their own domain context
 * (phone, template, notification type) and should log with those fields attached.
 */
export async function sendMsg91WhatsappTemplate(
  authKey: string,
  businessNumber: string,
  toPhone10Digit: string,
  templateName: string,
  values: unknown[],
  buttonUrlValue?: string,
): Promise<Msg91SendResult> {
  const body = buildMsg91WhatsappBody(businessNumber, toPhone10Digit, templateName, values, buttonUrlValue)

  try {
    const res = await fetch(MSG91_WA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      return { success: false, status: res.status, errorBody }
    }

    return { success: true }
  } catch (networkError) {
    return { success: false, networkError }
  }
}
