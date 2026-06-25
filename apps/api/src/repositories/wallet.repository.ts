import { Prisma, WalletTransactionType } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { WalletTransactionFilters } from '@shared/types/wallet.types'
import { CREDIT_TYPES, DEBIT_TYPES } from '@shared/types/wallet.types'
import { WALLET_TX, WALLET_REFERENCE_MODELS } from '@shared/constants/wallet'
import { NotFoundError } from '../errors/app-error'

interface TransactionMeta {
  type: WalletTransactionType
  referenceModel?: string
  referenceId?: string
  description: string
  /** Set for expirable credits (cashback, promotional). Null = never expires. */
  expiresAt?: Date | null
}

export class WalletRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Finds a wallet by userId. Returns null if not found or soft-deleted.
   */
  async findByUserId(userId: string) {
    return this.prisma.wallet.findUnique({
      where: { userId },
    }).then(w => (w && !w.isDeleted) ? w : null)
  }

  /**
   * Creates a wallet for a user. Called during signup.
   */
  async create(userId: string) {
    return this.prisma.wallet.create({
      data: { userId },
    })
  }

  /**
   * Returns existing wallet or creates one if missing.
   * Uses upsert to handle race conditions safely.
   */
  async findOrCreate(userId: string) {
    const existing = await this.findByUserId(userId)
    if (existing) return existing

    try {
      return await this.create(userId)
    } catch (err: unknown) {
      const prismaCode = err instanceof Error && 'code' in err ? (err as { code: string }).code : null
      // P2003 = FK constraint violation (userId doesn't exist in User table)
      if (prismaCode === 'P2003') {
        throw new NotFoundError('User')
      }
      // P2002 = unique constraint violation (concurrent creation race)
      if (prismaCode === 'P2002') {
        const wallet = await this.findByUserId(userId)
        if (wallet) return wallet
      }
      throw err
    }
  }

  /**
   * Atomically credits a wallet balance and creates a WalletTransaction.
   *
   * Uses raw SQL for the balance increment to prevent read-then-write race conditions
   * (same pattern as Trip.currentBookings in trip.repository.ts).
   *
   * All operations run inside a Prisma interactive transaction.
   */
  async atomicCredit(walletId: string, amount: number, meta: TransactionMeta) {
    return this.prisma.$transaction(async (tx) => {
      // Atomic balance increment — no race condition
      const rowsUpdated = await tx.$executeRaw`
        UPDATE "Wallet"
        SET "balance" = "balance" + ${amount},
            "updatedAt" = NOW()
        WHERE "id" = ${walletId}
          AND "isDeleted" = false
      `
      if (rowsUpdated === 0) return null

      // Fetch updated wallet for balanceAfter
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } })
      const balanceBefore = wallet.balance - amount
      const balanceAfter = wallet.balance

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId,
          amount,
          type: meta.type,
          referenceModel: meta.referenceModel ?? null,
          referenceId: meta.referenceId ?? null,
          description: meta.description,
          balanceBefore,
          balanceAfter,
          expiresAt: meta.expiresAt ?? null,
        },
      })

      return { wallet, transaction }
    })
  }

  /**
   * Atomically debits a wallet balance and creates a WalletTransaction.
   *
   * The WHERE clause includes `balance >= amount` to prevent negative balance
   * at the DB level (defense-in-depth with the CHECK constraint).
   *
   * @throws Error if balance is insufficient (rowsUpdated === 0)
   */
  async atomicDebit(walletId: string, amount: number, meta: TransactionMeta) {
    return this.prisma.$transaction(async (tx) => {
      // Atomic balance decrement with balance check — prevents overdraft
      const rowsUpdated = await tx.$executeRaw`
        UPDATE "Wallet"
        SET "balance" = "balance" - ${amount},
            "updatedAt" = NOW()
        WHERE "id" = ${walletId}
          AND "balance" >= ${amount}
          AND "isDeleted" = false
      `
      if (rowsUpdated === 0) return null

      // Fetch updated wallet for balanceAfter
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } })
      const balanceBefore = wallet.balance + amount
      const balanceAfter = wallet.balance

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId,
          amount,
          type: meta.type,
          referenceModel: meta.referenceModel ?? null,
          referenceId: meta.referenceId ?? null,
          description: meta.description,
          balanceBefore,
          balanceAfter,
        },
      })

      return { wallet, transaction }
    })
  }

  /**
   * Finds paginated wallet transactions for a wallet.
   * Supports filtering by type and date range.
   */
  async findTransactions(
    walletId: string,
    filters: Omit<WalletTransactionFilters, 'page' | 'limit'>,
    pagination: { offset: number; limit: number },
  ) {
    const where = this.buildTransactionWhere(walletId, filters)
    return this.prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    })
  }

  /**
   * Counts wallet transactions matching filters (for pagination total).
   */
  async countTransactions(
    walletId: string,
    filters: Omit<WalletTransactionFilters, 'page' | 'limit'>,
  ) {
    const where = this.buildTransactionWhere(walletId, filters)
    return this.prisma.walletTransaction.count({ where })
  }

  /**
   * Batch-fetch wallets by their IDs. Used by the expiry cron to avoid N+1
   * (one findByUserId per credit → one query for all affected wallets).
   */
  async findManyByIds(walletIds: string[]) {
    return this.prisma.wallet.findMany({
      where: { id: { in: walletIds }, isDeleted: false },
      select: { id: true, balance: true, userId: true },
    })
  }

  /**
   * Returns all non-deleted wallets. Used by reconciliation cron.
   * Only fetches id + balance — no heavy fields needed for drift detection.
   */
  async findAll() {
    return this.prisma.wallet.findMany({
      where: { isDeleted: false },
      select: { id: true, balance: true },
    })
  }

  /**
   * Computes the net balance from WalletTransactions for a given wallet.
   * SUM(credit amounts) - SUM(debit amounts).
   * Used by reconciliation to compare against cached balance.
   *
   * @deprecated Prefer sumByDirectionBatch() for reconciliation cron to avoid N+1.
   */
  async sumByDirection(walletId: string) {
    const result = await this.prisma.walletTransaction.groupBy({
      by: ['type'],
      where: { walletId },
      _sum: { amount: true },
    })

    let computed = 0
    for (const row of result) {
      const sum = row._sum.amount ?? 0
      if (CREDIT_TYPES.includes(row.type as typeof CREDIT_TYPES[number])) {
        computed += sum
      } else {
        computed -= sum
      }
    }

    return computed
  }

  /**
   * Batch version of sumByDirection: computes net balances for ALL wallets
   * in a single groupBy query instead of one query per wallet (N+1 fix).
   *
   * Returns a Map<walletId, computedBalance> for O(1) lookup during reconcile.
   */
  async sumByDirectionBatch(): Promise<Map<string, number>> {
    const rows = await this.prisma.walletTransaction.groupBy({
      by: ['walletId', 'type'],
      _sum: { amount: true },
    })

    const totals = new Map<string, number>()
    for (const row of rows) {
      const prev = totals.get(row.walletId) ?? 0
      const sum = row._sum.amount ?? 0
      if (CREDIT_TYPES.includes(row.type as typeof CREDIT_TYPES[number])) {
        totals.set(row.walletId, prev + sum)
      } else {
        totals.set(row.walletId, prev - sum)
      }
    }
    return totals
  }

  /**
   * Returns aggregated totals: totalCredits, totalDebits, totalCashback
   */
  async getWalletStats(walletId: string) {
    const result = await this.prisma.walletTransaction.groupBy({
      by: ['type'],
      where: { walletId },
      _sum: { amount: true },
    })

    let totalCredits = 0
    let totalDebits = 0
    let totalCashback = 0

    for (const row of result) {
      const sum = row._sum.amount ?? 0
      const txType = row.type as typeof CREDIT_TYPES[number]
      if (row.type === WALLET_TX.CASHBACK) {
        totalCashback += sum
      }
      if (CREDIT_TYPES.includes(txType)) {
        totalCredits += sum
      } else if (DEBIT_TYPES.includes(row.type as typeof DEBIT_TYPES[number])) {
        totalDebits += sum
      }
    }

    return { totalCredits, totalDebits, totalCashback }
  }

  /**
   * CASHBACK transactions for a wallet, enriched with trip name via booking→trip join.
   * Used by: WalletService.getCashbackHistory() (traveler view)
   */
  async findCashbackTransactionsEnriched(
    walletId: string,
    pagination: { skip: number; take: number },
  ) {
    const where: Prisma.WalletTransactionWhereInput = {
      walletId,
      type: WALLET_TX.CASHBACK,
      referenceModel: WALLET_REFERENCE_MODELS.BOOKING,
    }

    const [txns, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.walletTransaction.count({ where }),
    ])

    // Resolve trip names from booking→trip
    const bookingIds = txns
      .map((tx) => tx.referenceId)
      .filter((id): id is string => id !== null)

    const bookings = bookingIds.length
      ? await this.prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, trip: { select: { title: true } } },
        })
      : []

    const bookingTripMap = new Map(bookings.map((b) => [b.id, b.trip.title]))

    const data = txns.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type as string,
      referenceModel: tx.referenceModel,
      referenceId: tx.referenceId,
      description: tx.description,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      createdAt: tx.createdAt.toISOString(),
      tripName: tx.referenceId ? bookingTripMap.get(tx.referenceId) ?? null : null,
    }))

    return { data, total }
  }

  /**
   * All CASHBACK grouped by user for admin view.
   * Returns: userId, userName, email, totalCashback, count, latestIssuedAt
   */
  async getCashbackByUser(pagination: { skip: number; take: number }) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        userId: string
        userName: string
        email: string | null
        totalCashback: bigint
        count: bigint
        latestIssuedAt: Date
      }>
    >`
      SELECT u."id" AS "userId",
             u."name" AS "userName",
             u."email" AS "email",
             COALESCE(SUM(wt."amount"), 0) AS "totalCashback",
             COUNT(wt."id") AS "count",
             MAX(wt."createdAt") AS "latestIssuedAt"
      FROM "WalletTransaction" wt
      JOIN "Wallet" w ON w."id" = wt."walletId"
      JOIN "User" u ON u."id" = w."userId"
      WHERE wt."type"::text = ${WALLET_TX.CASHBACK}
        AND wt."referenceModel" = ${WALLET_REFERENCE_MODELS.BOOKING}
      GROUP BY u."id", u."name", u."email"
      ORDER BY "totalCashback" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `

    const countResult = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(DISTINCT w."userId") AS "total"
      FROM "WalletTransaction" wt
      JOIN "Wallet" w ON w."id" = wt."walletId"
      WHERE wt."type"::text = ${WALLET_TX.CASHBACK}
        AND wt."referenceModel" = ${WALLET_REFERENCE_MODELS.BOOKING}
    `

    return {
      data: rows.map((r) => ({
        userId: r.userId,
        userName: r.userName,
        email: r.email,
        totalCashback: Number(r.totalCashback),
        count: Number(r.count),
        latestIssuedAt: r.latestIssuedAt.toISOString(),
      })),
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  /**
   * All CASHBACK grouped by trip for admin view.
   * Returns: tripId, tripTitle, startDate, endDate, totalCashback, travelerCount
   */
  async getCashbackByTrip(pagination: { skip: number; take: number }) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        tripId: string
        tripTitle: string
        startDate: Date
        endDate: Date
        totalCashback: bigint
        travelerCount: bigint
      }>
    >`
      SELECT t."id" AS "tripId",
             t."title" AS "tripTitle",
             t."startDate" AS "startDate",
             t."endDate" AS "endDate",
             COALESCE(SUM(wt."amount"), 0) AS "totalCashback",
             COUNT(DISTINCT w."userId") AS "travelerCount"
      FROM "WalletTransaction" wt
      JOIN "Booking" b ON b."id" = wt."referenceId"
      JOIN "Trip" t ON t."id" = b."tripId"
      JOIN "Wallet" w ON w."id" = wt."walletId"
      WHERE wt."type"::text = ${WALLET_TX.CASHBACK}
        AND wt."referenceModel" = ${WALLET_REFERENCE_MODELS.BOOKING}
      GROUP BY t."id", t."title", t."startDate", t."endDate"
      ORDER BY "totalCashback" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `

    const countResult = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(DISTINCT b."tripId") AS "total"
      FROM "WalletTransaction" wt
      JOIN "Booking" b ON b."id" = wt."referenceId"
      WHERE wt."type"::text = ${WALLET_TX.CASHBACK}
        AND wt."referenceModel" = ${WALLET_REFERENCE_MODELS.BOOKING}
    `

    return {
      data: rows.map((r) => ({
        tripId: r.tripId,
        tripTitle: r.tripTitle,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate.toISOString(),
        totalCashback: Number(r.totalCashback),
        travelerCount: Number(r.travelerCount),
      })),
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  /**
   * Per-user cashback detail: all cashback transactions for a specific user.
   * Returns: bookingId, tripTitle, bookingAmount, amount, issuedAt
   */
  async getCashbackForUserDetail(
    userId: string,
    pagination: { skip: number; take: number },
  ) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        bookingId: string
        tripTitle: string
        bookingAmount: number
        amount: number
        issuedAt: Date
      }>
    >`
      SELECT b."id" AS "bookingId",
             t."title" AS "tripTitle",
             b."totalAmount" AS "bookingAmount",
             wt."amount" AS "amount",
             wt."createdAt" AS "issuedAt"
      FROM "WalletTransaction" wt
      JOIN "Wallet" w ON w."id" = wt."walletId"
      JOIN "Booking" b ON b."id" = wt."referenceId"
      JOIN "Trip" t ON t."id" = b."tripId"
      WHERE wt."type"::text = ${WALLET_TX.CASHBACK}
        AND wt."referenceModel" = ${WALLET_REFERENCE_MODELS.BOOKING}
        AND w."userId" = ${userId}
      ORDER BY wt."createdAt" DESC
      LIMIT ${pagination.take} OFFSET ${pagination.skip}
    `

    const countResult = await this.prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) AS "total"
      FROM "WalletTransaction" wt
      JOIN "Wallet" w ON w."id" = wt."walletId"
      WHERE wt."type"::text = ${WALLET_TX.CASHBACK}
        AND wt."referenceModel" = ${WALLET_REFERENCE_MODELS.BOOKING}
        AND w."userId" = ${userId}
    `

    return {
      data: rows.map((r) => ({
        bookingId: r.bookingId,
        tripTitle: r.tripTitle,
        bookingAmount: Number(r.bookingAmount),
        amount: Number(r.amount),
        issuedAt: r.issuedAt.toISOString(),
      })),
      total: Number(countResult[0]?.total ?? 0),
    }
  }

  /**
   * Returns expirable credit transactions that have passed their expiresAt
   * and have NOT already had a matching EXPIRY debit issued.
   *
   * The sweep cron calls this to find credits to void.
   * Batch-limited to prevent long-running transactions.
   */
  async findExpiredCreditsToVoid(now: Date, limit = 100) {
    // Credits past their expiry date
    const candidates = await this.prisma.walletTransaction.findMany({
      where: {
        expiresAt: { lt: now },
        type: { in: [WALLET_TX.CASHBACK as WalletTransactionType, 'PROMOTIONAL_CREDIT' as WalletTransactionType] },
      },
      select: {
        id: true,
        walletId: true,
        amount: true,
        wallet: { select: { userId: true } },
      },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    })

    if (candidates.length === 0) return []

    // Filter out those already expired (have a matching EXPIRY debit)
    const candidateIds = candidates.map((c) => c.id)
    const alreadyExpired = await this.prisma.walletTransaction.findMany({
      where: {
        type: 'EXPIRY' as WalletTransactionType,
        referenceModel: 'WalletTransaction',
        referenceId: { in: candidateIds },
      },
      select: { referenceId: true },
    })
    const expiredSet = new Set(alreadyExpired.map((e) => e.referenceId))

    return candidates.filter((c) => !expiredSet.has(c.id))
  }

  /**
   * Returns expirable credits expiring within the given warning window
   * that haven't had a reminder sent yet (expiryReminderSentAt IS NULL).
   */
  async findCreditsNeedingExpiryReminder(windowEnd: Date, limit = 200) {
    return this.prisma.walletTransaction.findMany({
      where: {
        expiresAt: { lte: windowEnd, gt: new Date() },
        expiryReminderSentAt: null,
        type: { in: [WALLET_TX.CASHBACK as WalletTransactionType, 'PROMOTIONAL_CREDIT' as WalletTransactionType] },
      },
      select: {
        id: true,
        amount: true,
        expiresAt: true,
        wallet: { select: { userId: true, user: { select: { id: true, email: true, name: true } } } },
      },
      take: limit,
    })
  }

  /**
   * Marks expiryReminderSentAt on a batch of WalletTransaction IDs.
   */
  async markExpiryReminderSent(ids: string[], sentAt: Date) {
    return this.prisma.walletTransaction.updateMany({
      where: { id: { in: ids } },
      data: { expiryReminderSentAt: sentAt },
    })
  }

  private buildTransactionWhere(
    walletId: string,
    filters: Omit<WalletTransactionFilters, 'page' | 'limit'>,
  ): Prisma.WalletTransactionWhereInput {
    return {
      walletId,
      ...(filters.type && { type: filters.type as WalletTransactionType }),
      ...(filters.fromDate || filters.toDate
        ? {
            createdAt: {
              ...(filters.fromDate && { gte: new Date(filters.fromDate) }),
              ...(filters.toDate && { lte: new Date(filters.toDate) }),
            },
          }
        : {}),
    }
  }
}
