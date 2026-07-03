import { logger } from '../utils/logger'
import { env } from './env'

export interface CashfreeConfig {
  appId: string
  secretKey: string
  webhookSecret: string
  baseUrl: string
  apiVersion: string
  /** 'sandbox' | 'production' — used by gateways to gate real-money operations */
  environment: 'sandbox' | 'production'
}

const CASHFREE_BASE_URLS = {
  sandbox: 'https://sandbox.cashfree.com/pg',
  production: 'https://api.cashfree.com/pg',
} as const

const CASHFREE_API_VERSION = '2025-01-01'

function createCashfreeConfig(): CashfreeConfig | null {
  const { CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV } = env

  if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    logger.warn('Cashfree not configured — CASHFREE_APP_ID / CASHFREE_SECRET_KEY missing')
    return null
  }

  return {
    appId: CASHFREE_APP_ID,
    secretKey: CASHFREE_SECRET_KEY,
    webhookSecret: env.CASHFREE_WEBHOOK_SECRET ?? CASHFREE_SECRET_KEY,
    baseUrl: CASHFREE_BASE_URLS[CASHFREE_ENV],
    apiVersion: CASHFREE_API_VERSION,
    environment: CASHFREE_ENV,
  }
}

export const cashfreeConfig = createCashfreeConfig()

export function isCashfreeConfigured(): boolean {
  return cashfreeConfig !== null
}
