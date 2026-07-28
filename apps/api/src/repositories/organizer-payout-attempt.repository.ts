import type { ExtendedPrismaClient } from '../lib/prisma'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'
import { ORGANIZER_PAYOUT_ATTEMPT_STATUS, ORGANIZER_PAYOUT_ATTEMPT_RECENCY_WINDOW_MS, type OrganizerPayoutAttemptStatus } from '../utils/constants'

/**
 * Ledger-before-gateway-call rows for PayoutService.releaseOrganizerWalletPayout — see
 * schema.prisma's OrganizerPayoutAttempt docblock and
 * docs/codebase/Payments & Webhooks.md "Organizer earnings via Wallet ledger".
 */
export class OrganizerPayoutAttemptRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /** Creates the INITIATED row. Caller supplies `id` explicitly so idempotencyKey can be
   *  derived from that same id (buildIdempotencyKey('ORG_WALLET_PAYOUT', id)) in one write. */
  async create(data: { id: string; organizerId: string; idempotencyKey: string; requestedAmount: number }) {
    return this.prisma.organizerPayoutAttempt.create({
      data: { ...data, status: ORGANIZER_PAYOUT_ATTEMPT_STATUS.INITIATED },
    })
  }

  async updateStatus(id: string, status: OrganizerPayoutAttemptStatus, gatewayTransferId?: string) {
    return this.prisma.organizerPayoutAttempt.update({
      where: { id },
      data: { status, ...(gatewayTransferId ? { gatewayTransferId } : {}) },
    })
  }

  /**
   * Finds the most recent INITIATED attempt for this organizer within the recency
   * window (default: ORGANIZER_PAYOUT_ATTEMPT_RECENCY_WINDOW_MS, matching the release
   * lock's TTL) — used to detect a slow gateway call whose lock may have already
   * expired, so a concurrent release doesn't re-read a stale balance and double-pay.
   */
  async findRecentInitiated(organizerId: string, windowMs: number = ORGANIZER_PAYOUT_ATTEMPT_RECENCY_WINDOW_MS) {
    return this.prisma.organizerPayoutAttempt.findFirst({
      where: {
        organizerId,
        status: ORGANIZER_PAYOUT_ATTEMPT_STATUS.INITIATED,
        createdAt: { gte: new Date(Date.now() - windowMs) },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Finds a SUCCEEDED attempt for this organizer whose gateway payout was never
   * followed by a matching WalletTransaction debit (the "ledger_mismatch" hole — see
   * PayoutService.releaseOrganizerWalletPayout's walletService.debit() catch block).
   *
   * A debit for this path is always recorded with
   * type=WALLET_TX.ORGANIZER_PAYOUT, referenceModel=WALLET_REFERENCE_MODELS.RAZORPAYX_PAYOUT,
   * referenceId=<the attempt's own gatewayTransferId> — see WalletTransaction's
   * @@unique([type, referenceModel, referenceId]). An attempt with no WalletTransaction
   * matching that triple means RazorpayX was paid but the ledger was never debited:
   * calling the gateway again for this organizer would be a second real transfer for
   * money already sent once, so callers MUST short-circuit before any gateway call.
   *
   * Scoped per-organizer for the pre-gateway-call guard; small result sets (SUCCEEDED
   * attempts are rare) so a two-step "fetch attempts, fetch matching debits, diff in
   * memory" is simpler and just as correct as a raw NOT EXISTS join here.
   */
  async findUnreconciledSucceeded(organizerId: string) {
    const succeeded = await this.prisma.organizerPayoutAttempt.findMany({
      where: {
        organizerId,
        status: ORGANIZER_PAYOUT_ATTEMPT_STATUS.SUCCEEDED,
        gatewayTransferId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (succeeded.length === 0) return null

    const gatewayTransferIds = succeeded.map((a) => a.gatewayTransferId!)
    const debits = await this.prisma.walletTransaction.findMany({
      where: {
        type: WALLET_TX.ORGANIZER_PAYOUT,
        referenceModel: WALLET_REFERENCE_MODELS.RAZORPAYX_PAYOUT,
        referenceId: { in: gatewayTransferIds },
      },
      select: { referenceId: true },
    })
    const debitedTransferIds = new Set(debits.map((d) => d.referenceId))

    return succeeded.find((a) => !debitedTransferIds.has(a.gatewayTransferId!)) ?? null
  }

  /**
   * Admin-ops visibility: counts unreconciled SUCCEEDED attempts (see
   * findUnreconciledSucceeded) per organizer, for the given set of organizer ids.
   * Used to flag rows on GET /admin/payouts/pending so an operator can see which
   * organizers need manual reconciliation before any further payout is attempted.
   */
  async countUnreconciledByOrganizerIds(organizerIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (organizerIds.length === 0) return result

    const succeeded = await this.prisma.organizerPayoutAttempt.findMany({
      where: {
        organizerId: { in: organizerIds },
        status: ORGANIZER_PAYOUT_ATTEMPT_STATUS.SUCCEEDED,
        gatewayTransferId: { not: null },
      },
      select: { organizerId: true, gatewayTransferId: true },
    })
    if (succeeded.length === 0) return result

    const gatewayTransferIds = succeeded.map((a) => a.gatewayTransferId!)
    const debits = await this.prisma.walletTransaction.findMany({
      where: {
        type: WALLET_TX.ORGANIZER_PAYOUT,
        referenceModel: WALLET_REFERENCE_MODELS.RAZORPAYX_PAYOUT,
        referenceId: { in: gatewayTransferIds },
      },
      select: { referenceId: true },
    })
    const debitedTransferIds = new Set(debits.map((d) => d.referenceId))

    for (const attempt of succeeded) {
      if (!debitedTransferIds.has(attempt.gatewayTransferId!)) {
        result.set(attempt.organizerId, (result.get(attempt.organizerId) ?? 0) + 1)
      }
    }
    return result
  }
}
