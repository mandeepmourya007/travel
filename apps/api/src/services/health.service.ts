import type { Logger } from 'pino'
import type { ConnectivityCheckService, ConnectivityCheckResult } from './connectivity-check.service'
import { HEALTH_CHECK_TIMEOUT_MS } from '../utils/constants'

export type ReadinessCheckStatus = 'up' | 'down' | 'skipped'

export interface ReadinessResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    cloudinary: ReadinessCheckStatus
    paymentGateway: ReadinessCheckStatus
    resend: ReadinessCheckStatus
    msg91: ReadinessCheckStatus
  }
  detail: {
    cloudinary?: string
    paymentGateway?: string
    resend?: string
    msg91?: string
  }
  /** Deploy-checklist items this probe deliberately does NOT verify. */
  notes: string[]
  timestamp: string
}

const READINESS_NOTES = [
  'MSG91 template/DLT approval and WhatsApp Business webhook dashboard configuration are NOT verified by this probe — confirm those manually per the deploy checklist.',
  'This probe checks credential validity only — it does not send email/SMS/WhatsApp or create real orders/payments.',
]

/**
 * Deep readiness probe (GET /api/v1/health/ready): verifies third-party
 * credentials are valid WITHOUT any side effects — no email/SMS/WhatsApp sent,
 * no real payment order created. Distinct from GET /health (DB + Redis only,
 * hit by Render's keep-alive cron — must stay cheap and unauthenticated).
 *
 * All actual connectivity/credential-check logic lives in ConnectivityCheckService —
 * this service only orchestrates the four checks and aggregates their statuses.
 */
export class HealthService {
  constructor(
    private connectivityCheckService: ConnectivityCheckService,
    private logger: Logger,
  ) {}

  async getReadiness(): Promise<ReadinessResult> {
    const [cloudinary, paymentGateway, resend, msg91] = await Promise.all([
      this.safeCheck('cloudinary', () => this.connectivityCheckService.checkCloudinary()),
      this.safeCheck('paymentGateway', () => this.connectivityCheckService.checkPaymentGateway()),
      this.safeCheck('resend', () => this.connectivityCheckService.checkResend()),
      this.safeCheck('msg91', () => this.connectivityCheckService.checkMsg91()),
    ])

    const checks = {
      cloudinary: cloudinary.status,
      paymentGateway: paymentGateway.status,
      resend: resend.status,
      msg91: msg91.status,
    }

    const detail = {
      cloudinary: cloudinary.detail,
      paymentGateway: paymentGateway.detail,
      resend: resend.detail,
      msg91: msg91.detail,
    }

    const nonSkipped = Object.values(checks).filter((s): s is 'up' | 'down' => s !== 'skipped')
    let status: ReadinessResult['status']
    if (nonSkipped.length === 0) {
      // Nothing configured to check — treat as unhealthy rather than a false "healthy".
      status = 'unhealthy'
    } else if (nonSkipped.every((s) => s === 'up')) {
      status = 'healthy'
    } else if (nonSkipped.every((s) => s === 'down')) {
      status = 'unhealthy'
    } else {
      status = 'degraded'
    }

    return {
      status,
      checks,
      detail,
      notes: READINESS_NOTES,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Races the check against HEALTH_CHECK_TIMEOUT_MS so a hung third party (none of the
   * four underlying calls set an AbortSignal/timeout of their own) resolves to `down`
   * instead of holding the request open — Node's undici default fetch timeout is ~300s.
   */
  private async safeCheck(
    name: string,
    fn: () => Promise<ConnectivityCheckResult>,
  ): Promise<ConnectivityCheckResult> {
    try {
      return await Promise.race([
        fn(),
        new Promise<ConnectivityCheckResult>((resolve) => {
          const timer = setTimeout(() => {
            this.logger.warn({ check: name, timeoutMs: HEALTH_CHECK_TIMEOUT_MS }, 'Readiness check timed out')
            resolve({ status: 'down', detail: `${name} check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms` })
          }, HEALTH_CHECK_TIMEOUT_MS)
          timer.unref()
        }),
      ])
    } catch (error) {
      this.logger.error({ error, check: name }, 'Readiness check threw unexpectedly')
      return { status: 'down', detail: `${name} check threw unexpectedly` }
    }
  }
}
