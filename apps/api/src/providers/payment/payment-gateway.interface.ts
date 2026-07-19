/**
 * Adapter pattern — swap payment gateway without changing PaymentService.
 *
 * Contract:
 * - All gateway I/O + signature schemes live here.
 * - DB writes, idempotency guards, and status-transition logic stay in PaymentService.
 * - Amounts received by these methods are in PAISE (Int); gateways convert internally.
 * - verifyAndParseWebhook MUST throw on invalid signature (PaymentService trusts this).
 *
 * Pattern: Adapter (GoF) — maps provider API to neutral interface.
 *          Strategy (GoF) — selected per env.PAYMENT_GATEWAY or per-tx provider.
 */

// Re-export all normalized types so callers only need to import from this file
export type {
  CreateOrderParams,
  NormalizedOrder,
  NormalizedPayment,
  NormalizedWebhookEvent,
  RazorpayClientPayload,
  CashfreeClientPayload,
  PaymentProvider,
  ClientCallbackInput,
  SplitParams,
  NormalizedEventType,
  CreatePayoutAccountParams,
  NormalizedPayoutAccount,
} from '../../types/payment.types'

import type {
  CreateOrderParams,
  NormalizedOrder,
  NormalizedPayment,
  NormalizedWebhookEvent,
  PaymentProvider,
  ClientCallbackInput,
  CreatePayoutAccountParams,
  NormalizedPayoutAccount,
} from '../../types/payment.types'

export interface IPaymentGateway {
  readonly provider: PaymentProvider

  /**
   * Creates a payment order on the provider.
   * Optional split param wires organizer payout at order creation
   * (Razorpay transfers[] / Cashfree order_splits[]).
   *
   * @throws PaymentError — provider API failure
   * @throws ValidationError — zero/negative amount
   */
  createOrder(params: CreateOrderParams): Promise<NormalizedOrder>

  /**
   * Captures a previously authorized payment.
   * Razorpay: explicit capture call (payment_capture:0 deferred mode).
   * Cashfree: auto-captured — this is a no-op that returns current status.
   *
   * Must be idempotent: "already captured" errors should be swallowed and the
   * existing capture returned.
   *
   * @throws PaymentError — only when capture genuinely failed
   */
  capturePayment(paymentId: string, amountPaise: number, currency?: string): Promise<NormalizedPayment>

  /**
   * Verifies the client-side payment callback after checkout completes.
   * Razorpay: HMAC-SHA256(orderId|paymentId, keySecret).
   * Cashfree: server-side order-status fetch (no client HMAC scheme).
   *
   * @returns true if verification passes
   */
  verifyClientCallback(input: ClientCallbackInput): Promise<boolean> | boolean

  /**
   * Polls provider API for order status.
   * Returns a normalized status string: 'paid' on success (regardless of provider vocabulary).
   * Razorpay: 'created' | 'attempted' | 'paid'. Cashfree 'PAID' → normalized 'paid'.
   *
   * @throws PaymentError — API failure
   */
  checkOrderStatus(orderId: string): Promise<string>

  /**
   * Fetches the first authorized/captured payment ID for an order.
   * Returns null if unavailable (graceful — cron retries).
   */
  fetchPaymentIdForOrder(orderId: string): Promise<string | null>

  /**
   * Initiates a refund.
   * Razorpay: reverse_all:1 (reverses organizer transfer too).
   * Cashfree: refund_splits: [{ vendor_id, amount: 0 }] — the organizer never gets
   * debited (no-clawback design, see utils/payout.ts): only the deposit was ever
   * released, and the deposit is by construction always <= the platform-retained
   * amount, so refunds are paid entirely out of the platform's share.
   * Pass `notes.vendorAccountId` (Cashfree vendor_id) to force the zero-amount split;
   * omit it for orders that were never split.
   *
   * @throws PaymentError — provider API failure
   */
  initiateRefund(
    paymentId: string,
    amountPaise: number,
    notes?: Record<string, unknown>,
  ): Promise<{ refundId: string; raw: unknown }>

  /**
   * Transfers the held balance tranche to the organizer's vendor account, on demand,
   * after the refund cliff has passed. Cashfree-only (Easy Split "on demand" transfer);
   * Razorpay has no equivalent — it releases its single SafePay escrow hold instead via
   * releaseTransferHold, so RazorpayGateway throws PaymentError('unsupported') here.
   *
   * Idempotency: callers MUST pass a deterministic `ctx.idempotencyKey` (e.g.
   * `BALANCE_${orderId}`) so a retried call after a network timeout does not create a
   * second transfer. Implementations must forward it to the gateway's own idempotency
   * mechanism where one exists.
   *
   * @throws PaymentError — provider API failure, or unsupported on this gateway
   */
  transferToVendor(
    vendorId: string,
    amountPaise: number,
    ctx: { orderId: string; idempotencyKey: string; notes?: Record<string, unknown> },
  ): Promise<{ transferId: string; raw: unknown }>

  /**
   * Fetches the transfer/split identifier for a captured payment.
   * Razorpay: Route transfer ID (lazy-fetched post-capture).
   * Cashfree: split/settlement reference from order.
   *
   * Returns null if not found — lifecycle cron retries.
   */
  fetchTransferId(paymentId: string): Promise<string | null>

  /**
   * Releases the escrow hold so funds settle to the organizer.
   * Razorpay: PATCH /transfers/:id { on_hold: false }.
   * Cashfree: mark deferred-settlement eligible / release.
   *
   * @throws PaymentError — provider API failure
   */
  releaseTransferHold(
    transferId: string,
    ctx?: { orderId?: string; vendorAccountId?: string },
  ): Promise<void>

  /**
   * Creates the organizer's payout account with the provider.
   * Razorpay: Route linked account (POST /v2/accounts).
   * Cashfree: Easy Split vendor (POST /easy-split/vendors).
   *
   * Returned accountId is stored as razorpayAccountId or cashfreeVendorId depending on provider.
   * @throws PaymentError — provider API failure
   */
  createPayoutAccount(params: CreatePayoutAccountParams): Promise<NormalizedPayoutAccount>

  /**
   * Verifies the webhook signature using the provider's own scheme, then parses
   * and normalizes the event into NormalizedWebhookEvent.
   *
   * Razorpay: HMAC-SHA256(rawBody, webhookSecret) → hex → x-razorpay-signature.
   * Cashfree: HMAC-SHA256(timestamp+rawBody, secretKey) → base64 → x-webhook-signature.
   *
   * MUST throw AuthError on invalid/missing signature.
   * MUST return a NormalizedWebhookEvent with type=UNKNOWN for unrecognized event names.
   */
  verifyAndParseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): NormalizedWebhookEvent
}
