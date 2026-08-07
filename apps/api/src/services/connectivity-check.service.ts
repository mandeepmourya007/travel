import { v2 as cloudinary } from 'cloudinary'
import { Resend } from 'resend'
import type { Logger } from 'pino'
import type { PaymentProvider } from '../types/payment.types'
import type { CashfreeConfig } from '../config/cashfree'
import { PAYMENT_PROVIDER } from '@shared/constants'
import { HEALTH_CHECK_TIMEOUT_MS } from '../utils/constants'
import { buildRazorpayAuthHeader, buildCashfreeHeaders } from '../providers/payment/payment-auth.util'

export type ConnectivityCheckStatus = 'up' | 'down' | 'skipped'

export interface ConnectivityCheckResult {
  status: ConnectivityCheckStatus
  detail?: string
}

export interface ConnectivityCheckServiceConfig {
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string } | null
  paymentGateway: {
    provider: PaymentProvider
    razorpay: { keyId: string; keySecret: string } | null
    cashfree: CashfreeConfig | null
  }
  email:
    | { kind: 'resend'; apiKey: string }
    | { kind: 'smtp' }
    | { kind: 'mock' }
  otp:
    | { kind: 'msg91'; authKey: string }
    | { kind: 'mock' }
}

// Sane floor below which the account is treated as needing a top-up. Purely for the
// `detail` string surfaced by the readiness probe — never echoes the raw balance.
const MSG91_LOW_BALANCE_FLOOR = 10

/**
 * Single home for every third-party connectivity/credential check used by the deep
 * readiness probe (GET /api/v1/health/ready).
 *
 * Deliberately independent of IPaymentGateway / IEmailProvider / IOtpProvider — those
 * are business-logic interfaces (create orders, send emails/SMS/WhatsApp) and must not
 * carry health-check concerns. This service is constructed directly from the raw,
 * already-configured SDK clients/config built in config/dependencies.ts, before those
 * get wrapped into gateway/provider objects — it never calls into a gateway/provider.
 *
 * Every check is side-effect-free: no orders, payments, emails, SMS, or WhatsApp
 * messages are ever sent — only cheap authenticated reads.
 *
 * INTENTIONAL, REVIEWED EXCEPTION to apps/api/CLAUDE.md's "never call Razorpay/Cashfree
 * SDKs directly from a service" rule: checkRazorpay/checkCashfree call fetch() directly
 * against the Razorpay/Cashfree REST APIs instead of going through IPaymentGateway. This
 * is deliberate — routing a read-only credential probe through the gateway interface
 * would re-pollute IPaymentGateway (a business-logic contract for orders/payments/refunds)
 * with a health-check concern. Do NOT "fix" this by adding a checkCredentials() method to
 * IPaymentGateway. The auth-header/base-URL construction itself IS shared with the real
 * gateways via payment-auth.util.ts to avoid drift.
 */
export class ConnectivityCheckService {
  private resendClient: Resend | null = null

  constructor(
    private config: ConnectivityCheckServiceConfig,
    private logger: Logger,
  ) {
    if (this.config.cloudinary) {
      cloudinary.config({
        cloud_name: this.config.cloudinary.cloudName,
        api_key: this.config.cloudinary.apiKey,
        api_secret: this.config.cloudinary.apiSecret,
      })
    }
    if (this.config.email.kind === 'resend') {
      this.resendClient = new Resend(this.config.email.apiKey)
    }
  }

  /**
   * `cloudinary.api.ping()` is a read-only admin-API call — it does not upload,
   * delete, or transform anything.
   */
  async checkCloudinary(): Promise<ConnectivityCheckResult> {
    if (!this.config.cloudinary) {
      return { status: 'skipped', detail: 'Cloudinary not configured' }
    }

    try {
      await cloudinary.api.ping()
      return { status: 'up' }
    } catch (error) {
      // Log the raw SDK error server-side only — never put it in the response `detail`.
      this.logger.warn({ error }, 'ConnectivityCheckService: Cloudinary ping failed')
      return { status: 'down', detail: 'Cloudinary credentials rejected or ping failed' }
    }
  }

  /** Verifies credentials only for whichever gateway is currently active (env.PAYMENT_GATEWAY). */
  async checkPaymentGateway(): Promise<ConnectivityCheckResult> {
    const pg = this.config.paymentGateway
    if (pg.provider === PAYMENT_PROVIDER.RAZORPAY && pg.razorpay) {
      return this.checkRazorpay(pg.razorpay)
    }
    if (pg.provider === PAYMENT_PROVIDER.CASHFREE && pg.cashfree) {
      return this.checkCashfree(pg.cashfree)
    }
    // Mirrors the previous MockPaymentGateway.verifyCredentials() contract — no real
    // gateway is configured for the active provider (dev-only; production fails at boot).
    return { status: 'up', detail: 'MockPaymentGateway — no real credentials to verify' }
  }

  /**
   * Fetches a deliberately non-existent order ID: a well-formed key pair gets a
   * 400/404 ("order not found") while a bad key pair gets a 401 — no order/payment
   * is ever created.
   */
  private async checkRazorpay(creds: { keyId: string; keySecret: string }): Promise<ConnectivityCheckResult> {
    try {
      const response = await fetch('https://api.razorpay.com/v1/orders/order_DoesNotExist00000', {
        method: 'GET',
        headers: { Authorization: buildRazorpayAuthHeader(creds.keyId, creds.keySecret) },
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      })

      if (response.status === 401) {
        return { status: 'down', detail: 'Razorpay authentication failed (401) — check RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET' }
      }

      // Any other status (400/404 "order not found") means the auth header was accepted.
      return { status: 'up' }
    } catch (error) {
      this.logger.warn({ error }, 'ConnectivityCheckService: Razorpay network error')
      return { status: 'down', detail: 'Network error reaching Razorpay API' }
    }
  }

  /**
   * Fetches a deliberately non-existent order ID: valid credentials get a 404
   * ("order not found") while bad credentials get a 401 — no order/payment is
   * ever created.
   */
  private async checkCashfree(config: CashfreeConfig): Promise<ConnectivityCheckResult> {
    try {
      const response = await fetch(`${config.baseUrl}/orders/health-check-nonexistent-order`, {
        method: 'GET',
        headers: buildCashfreeHeaders(config),
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      })

      if (response.status === 401) {
        return { status: 'down', detail: 'Cashfree authentication failed (401) — check CASHFREE_APP_ID/CASHFREE_SECRET_KEY' }
      }

      // Any other status (400/404 "order not found") means the credentials were accepted.
      return { status: 'up' }
    } catch (error) {
      this.logger.warn({ error }, 'ConnectivityCheckService: Cashfree network error')
      return { status: 'down', detail: 'Network error reaching Cashfree API' }
    }
  }

  /**
   * Lists sending domains (read-only) and reports `down` when the API key is invalid
   * OR none of the domains have reached `verified` status (catches DKIM/SPF DNS drift
   * that would otherwise silently land mail in spam). Never sends an email.
   * `skipped` when the active email provider isn't Resend (SMTP or mock).
   */
  async checkResend(): Promise<ConnectivityCheckResult> {
    if (this.config.email.kind === 'smtp') {
      return { status: 'skipped', detail: 'SMTP connection verification not implemented' }
    }
    if (this.config.email.kind === 'mock' || !this.resendClient) {
      return { status: 'skipped', detail: 'MockEmailProvider — no real provider configured' }
    }

    try {
      const { data, error } = await this.resendClient.domains.list()
      if (error) {
        // Log the raw SDK error server-side only — never put it in the response `detail`.
        this.logger.warn({ error }, 'ConnectivityCheckService: Resend domains.list failed')
        return { status: 'down', detail: 'Resend API key rejected' }
      }

      const domains = data?.data ?? []
      const hasVerifiedDomain = domains.some((d) => d.status === 'verified')
      if (!hasVerifiedDomain) {
        return {
          status: 'down',
          detail: domains.length === 0
            ? 'No sending domains configured on this Resend account'
            : `No verified domain found (statuses: ${domains.map((d) => d.status).join(', ')})`,
        }
      }

      return { status: 'up' }
    } catch (error) {
      this.logger.warn({ error }, 'ConnectivityCheckService: Resend network error')
      return { status: 'down', detail: 'Network error reaching Resend API' }
    }
  }

  /**
   * Reads the MSG91 account balance (read-only) — validates MSG91_AUTH_KEY and
   * surfaces a low/zero balance. Never sends an SMS/WhatsApp message. Does NOT verify
   * DLT/template approval — that stays a deploy-checklist item. The raw balance is
   * never returned in `detail`. `skipped` when no MSG91 OTP channel is active (mock).
   */
  async checkMsg91(): Promise<ConnectivityCheckResult> {
    if (this.config.otp.kind === 'mock') {
      return { status: 'skipped', detail: 'MockOtpProvider — no real provider configured' }
    }

    const authKey = this.config.otp.authKey
    try {
      const res = await fetch(`https://control.msg91.com/api/balance.php?authkey=${authKey}&type=4`, {
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      })
      if (!res.ok) {
        const text = await res.text()
        this.logger.warn({ status: res.status, body: text }, 'ConnectivityCheckService: MSG91 balance check failed')
        return { status: 'down', detail: `MSG91 balance check returned HTTP ${res.status}` }
      }

      const body = await res.text()
      // MSG91's balance endpoint returns a bare error string (not JSON, not 4xx) for
      // an invalid authkey — treat any non-numeric body as an auth failure.
      if (!/^-?\d+(\.\d+)?$/.test(body.trim())) {
        this.logger.warn({ body }, 'ConnectivityCheckService: MSG91 unexpected balance response')
        return { status: 'down', detail: 'MSG91 balance check returned an unexpected response — likely invalid MSG91_AUTH_KEY' }
      }

      const balance = Number(body.trim())
      // Log the raw balance server-side only — never in the response `detail`.
      this.logger.info({ balance }, 'ConnectivityCheckService: MSG91 balance check succeeded')
      if (balance < MSG91_LOW_BALANCE_FLOOR) {
        return { status: 'up', detail: 'MSG91 balance is low — top up soon' }
      }

      return { status: 'up' }
    } catch (error) {
      this.logger.warn({ error }, 'ConnectivityCheckService: MSG91 network error')
      return { status: 'down', detail: 'Network error reaching MSG91 API' }
    }
  }
}
