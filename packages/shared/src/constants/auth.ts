/**
 * Auth-related error sub-codes — a discriminator within the same HTTP `code`
 * (e.g. CONFLICT, FORBIDDEN) that lets the client branch on structure instead
 * of parsing message text. Shared because both apps/api (throws them) and
 * apps/web (branches on them, e.g. api-client's response interceptor) need
 * the exact same string.
 */
export const AUTH_ERROR_CODE = {
  /** 409 CONFLICT — phone already linked to a different account (attach flow) */
  PHONE_TAKEN: 'PHONE_TAKEN',
  /** 403 FORBIDDEN — mandatory phone verification not yet completed */
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
} as const
