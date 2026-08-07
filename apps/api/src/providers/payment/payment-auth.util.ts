/**
 * Pure helpers for building gateway auth headers. Extracted so the real gateway
 * adapters (razorpay.gateway.ts, cashfree.gateway.ts) and ConnectivityCheckService's
 * read-only credential probes (connectivity-check.service.ts) share exactly one
 * construction of each header shape — no business logic here, just header building.
 */

/**
 * Razorpay Basic-auth header value: `Basic base64(keyId:keySecret)`.
 * Used for both the SDK-less raw REST calls (createPayoutAccount, transfer release)
 * and the connectivity probe's read-only order fetch.
 */
export function buildRazorpayAuthHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`
}

/**
 * Cashfree's fixed header trio (x-client-id / x-client-secret / x-api-version).
 * Used by CashfreeGateway's private fetch() and the connectivity probe's
 * read-only order fetch.
 */
export function buildCashfreeHeaders(config: {
  appId: string
  secretKey: string
  apiVersion: string
}): Record<string, string> {
  return {
    'x-client-id': config.appId,
    'x-client-secret': config.secretKey,
    'x-api-version': config.apiVersion,
  }
}
