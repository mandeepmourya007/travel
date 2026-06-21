import type { Logger } from 'pino'
import type { WalletRepository } from '../repositories/wallet.repository'
import type { WalletTransactionDto, WalletTransactionFilters, WalletTransactionItem, WalletSummary, WalletTransactionType } from '@shared/types/wallet.types'
import { CREDIT_TYPES, DEBIT_TYPES } from '@shared/types/wallet.types'
import { NotFoundError, ValidationError } from '../errors/app-error'
import { WALLET_MAX_ADMIN_CREDIT, WALLET_MAX_ADMIN_DEBIT, PAGINATION_DEFAULTS, paginate, WALLET_EXPIRY_WARN_DAYS } from '../utils/constants'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'

export class WalletService {
  constructor(
    private walletRepo: WalletRepository,
    private logger: Logger,
  ) {}

  /**
   * Credits a wallet — used for refund, cashback, admin credit, promotional credit.
   * Validates: amount > 0, type is a credit type, wallet exists.
   *
   * @throws NotFoundError — wallet not found for user
   * @throws ValidationError — amount <= 0, wrong type
   */
  async credit(input: WalletTransactionDto): Promise<WalletTransactionItem> {
    this.validateAmount(input.amount)
    this.validateCreditType(input.type)

    const wallet = await this.walletRepo.findByUserId(input.userId)
    if (!wallet) throw new NotFoundError('Wallet')

    const result = await this.walletRepo.atomicCredit(wallet.id, input.amount, {
      type: input.type,
      referenceModel: input.referenceModel,
      referenceId: input.referenceId,
      description: input.description,
      expiresAt: input.expiresAt ?? null,
    })
    if (!result) throw new NotFoundError('Wallet')

    this.logger.info(
      { walletId: wallet.id, amount: input.amount, type: input.type },
      'Wallet credited',
    )

    return this.formatTransaction(result.transaction)
  }

  /**
   * Debits a wallet — used for booking deduction, admin debit, expiry.
   * Validates: amount > 0, type is a debit type, wallet exists, balance sufficient.
   *
   * @throws NotFoundError — wallet not found for user
   * @throws ValidationError — amount <= 0, wrong type, insufficient balance
   */
  async debit(input: WalletTransactionDto): Promise<WalletTransactionItem> {
    this.validateAmount(input.amount)
    this.validateDebitType(input.type)

    const wallet = await this.walletRepo.findByUserId(input.userId)
    if (!wallet) throw new NotFoundError('Wallet')

    const result = await this.walletRepo.atomicDebit(wallet.id, input.amount, {
      type: input.type,
      referenceModel: input.referenceModel,
      referenceId: input.referenceId,
      description: input.description,
    })
    if (!result) throw new ValidationError('Insufficient wallet balance')

    this.logger.info(
      { walletId: wallet.id, amount: input.amount, type: input.type },
      'Wallet debited',
    )

    return this.formatTransaction(result.transaction)
  }

  /**
   * Returns wallet balance and summary for a user.
   * Auto-creates wallet if missing (lazy initialization).
   */
  async getBalance(userId: string): Promise<WalletSummary> {
    const wallet = await this.walletRepo.findOrCreate(userId)

    const stats = await this.walletRepo.getWalletStats(wallet.id)

    return {
      id: wallet.id,
      balance: wallet.balance,
      currency: wallet.currency,
      totalCredits: stats.totalCredits,
      totalDebits: stats.totalDebits,
      totalCashback: stats.totalCashback,
      createdAt: wallet.createdAt.toISOString(),
    }
  }

  /**
   * Returns paginated, filterable transaction history for a user's wallet.
   * Auto-creates wallet if missing (lazy initialization).
   */
  async getTransactionHistory(
    userId: string,
    filters: WalletTransactionFilters,
  ) {
    const wallet = await this.walletRepo.findOrCreate(userId)

    const page = filters.page ?? PAGINATION_DEFAULTS.page
    const limit = filters.limit ?? PAGINATION_DEFAULTS.limit
    const offset = (page - 1) * limit

    const { type, fromDate, toDate } = filters

    const [data, total] = await Promise.all([
      this.walletRepo.findTransactions(wallet.id, { type, fromDate, toDate }, { offset, limit }),
      this.walletRepo.countTransactions(wallet.id, { type, fromDate, toDate }),
    ])

    return {
      data: data.map(this.formatTransaction),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Admin: credit a user's wallet with ADMIN_CREDIT type.
   *
   * @throws NotFoundError — target user's wallet not found
   * @throws ValidationError — amount exceeds max admin credit
   */
  async adminCredit(
    adminUserId: string,
    targetUserId: string,
    amount: number,
    description: string,
  ): Promise<WalletTransactionItem> {
    if (amount > WALLET_MAX_ADMIN_CREDIT) {
      throw new ValidationError(`Amount exceeds max admin credit of ₹${WALLET_MAX_ADMIN_CREDIT}`)
    }

    const result = await this.credit({
      userId: targetUserId,
      amount,
      type: WALLET_TX.ADMIN_CREDIT,
      referenceModel: WALLET_REFERENCE_MODELS.ADMIN_ACTION,
      referenceId: adminUserId,
      description,
    })

    this.logger.info(
      { adminUserId, targetUserId, amount },
      'Admin wallet credit',
    )

    return result
  }

  /**
   * Admin: debit a user's wallet with ADMIN_DEBIT type.
   *
   * @throws NotFoundError — target user's wallet not found
   * @throws ValidationError — amount exceeds max, insufficient balance
   */
  async adminDebit(
    adminUserId: string,
    targetUserId: string,
    amount: number,
    description: string,
  ): Promise<WalletTransactionItem> {
    if (amount > WALLET_MAX_ADMIN_DEBIT) {
      throw new ValidationError(`Amount exceeds max admin debit of ₹${WALLET_MAX_ADMIN_DEBIT}`)
    }

    const result = await this.debit({
      userId: targetUserId,
      amount,
      type: WALLET_TX.ADMIN_DEBIT,
      referenceModel: WALLET_REFERENCE_MODELS.ADMIN_ACTION,
      referenceId: adminUserId,
      description,
    })

    this.logger.info(
      { adminUserId, targetUserId, amount },
      'Admin wallet debit',
    )

    return result
  }

  /**
   * Returns paginated CASHBACK transactions with trip names for the traveler.
   * Calls walletRepo.findCashbackTransactionsEnriched() which joins booking→trip.
   */
  async getCashbackHistory(userId: string, filters: { page?: number; limit?: number }) {
    const wallet = await this.walletRepo.findOrCreate(userId)
    const pg = paginate(filters)

    const { data, total } = await this.walletRepo.findCashbackTransactionsEnriched(
      wallet.id,
      { skip: pg.skip, take: pg.take },
    )

    return { data, pagination: pg.meta(total) }
  }

  /**
   * Cron: expire credits past their expiresAt that haven't been voided yet.
   * Issues an EXPIRY debit for each, capped at the wallet's current balance
   * (never drives balance negative). Idempotent via @@unique constraint.
   *
   * @returns { voided: number; skipped: number } — skipped = insufficient balance or already expired
   */
  async expireCredits(): Promise<{ voided: number; skipped: number }> {
    const now = new Date()
    const candidates = await this.walletRepo.findExpiredCreditsToVoid(now)

    let voided = 0
    let skipped = 0

    for (const credit of candidates) {
      try {
        // Fetch current balance to cap the expiry debit
        const wallet = await this.walletRepo.findByUserId(credit.wallet.userId)
        if (!wallet) { skipped++; continue }

        const amount = Math.min(credit.amount, wallet.balance)
        if (amount <= 0) { skipped++; continue }

        await this.walletRepo.atomicDebit(wallet.id, amount, {
          type: WALLET_TX.EXPIRY as WalletTransactionType,
          referenceModel: WALLET_REFERENCE_MODELS.WALLET_TRANSACTION,
          referenceId: credit.id,
          description: 'Wallet credit expired',
        })
        voided++
        this.logger.info({ creditId: credit.id, userId: credit.wallet.userId, amount }, 'Wallet credit expired')
      } catch (err: unknown) {
        // P2002 = EXPIRY debit already exists (race condition) — safe to skip
        const isUniqueViolation = err instanceof Error && (err as { code?: unknown }).code === 'P2002'
        if (isUniqueViolation) { skipped++; continue }
        this.logger.warn({ creditId: credit.id, err }, 'Failed to expire wallet credit')
        skipped++
      }
    }

    return { voided, skipped }
  }

  /**
   * Returns expirable credits expiring within WALLET_EXPIRY_WARN_DAYS that
   * haven't had a reminder sent yet. Caller (cron) sends the notification and
   * calls markExpiryReminderSent.
   */
  async findCreditsNeedingExpiryReminder() {
    const windowEnd = new Date()
    windowEnd.setDate(windowEnd.getDate() + WALLET_EXPIRY_WARN_DAYS)
    return this.walletRepo.findCreditsNeedingExpiryReminder(windowEnd)
  }

  async markExpiryReminderSent(ids: string[], sentAt: Date) {
    return this.walletRepo.markExpiryReminderSent(ids, sentAt)
  }

  /**
   * Reconciliation cron: compare cached wallet.balance against computed
   * SUM(credits) - SUM(debits) from WalletTransaction. Logs drift but does NOT auto-fix.
   *
   * Uses a single batch groupBy instead of one query per wallet (N+1 fix).
   */
  async reconcile(): Promise<{ checked: number; drifted: number }> {
    const wallets = await this.walletRepo.findAll()
    const computedBalances = await this.walletRepo.sumByDirectionBatch()
    let drifted = 0

    for (const wallet of wallets) {
      const computed = computedBalances.get(wallet.id) ?? 0
      if (wallet.balance !== computed) {
        drifted++
        this.logger.error(
          { walletId: wallet.id, cached: wallet.balance, computed, drift: wallet.balance - computed },
          'Wallet balance drift detected',
        )
      }
    }

    return { checked: wallets.length, drifted }
  }

  // ─── Private helpers ───────────────────────────────

  private validateAmount(amount: number): void {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ValidationError('Amount must be a positive integer (whole rupees)')
    }
  }

  private validateCreditType(type: WalletTransactionType): void {
    if (!CREDIT_TYPES.includes(type)) {
      throw new ValidationError(`Invalid credit type: ${type}. Expected one of: ${CREDIT_TYPES.join(', ')}`)
    }
  }

  private validateDebitType(type: WalletTransactionType): void {
    if (!DEBIT_TYPES.includes(type)) {
      throw new ValidationError(`Invalid debit type: ${type}. Expected one of: ${DEBIT_TYPES.join(', ')}`)
    }
  }

  private formatTransaction(txn: {
    id: string
    amount: number
    type: string
    referenceModel: string | null
    referenceId: string | null
    description: string
    balanceBefore: number
    balanceAfter: number
    createdAt: Date
  }): WalletTransactionItem {
    return {
      id: txn.id,
      amount: txn.amount,
      type: txn.type as WalletTransactionItem['type'],
      referenceModel: txn.referenceModel,
      referenceId: txn.referenceId,
      description: txn.description,
      balanceBefore: txn.balanceBefore,
      balanceAfter: txn.balanceAfter,
      createdAt: txn.createdAt.toISOString(),
    }
  }
}
