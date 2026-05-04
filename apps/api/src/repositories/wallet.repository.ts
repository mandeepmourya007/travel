import { Prisma, WalletTransactionType } from '@prisma/client'
import type { ExtendedPrismaClient } from '../lib/prisma'
import type { WalletTransactionFilters } from '@shared/types/wallet.types'
import { CREDIT_TYPES, DEBIT_TYPES } from '@shared/types/wallet.types'

interface TransactionMeta {
  type: WalletTransactionType
  referenceModel?: string
  referenceId?: string
  description: string
}

export class WalletRepository {
  constructor(private prisma: ExtendedPrismaClient) {}

  /**
   * Finds a wallet by userId. Returns null if not found or soft-deleted.
   */
  async findByUserId(userId: string) {
    return this.prisma.wallet.findFirst({
      where: { userId, isDeleted: false },
    })
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
      // P2002 = unique constraint violation (concurrent creation race)
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2002') {
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
   * Returns all non-deleted wallets. Used by reconciliation cron.
   */
  async findAll() {
    return this.prisma.wallet.findMany({
      where: { isDeleted: false },
    })
  }

  /**
   * Computes the net balance from WalletTransactions for a given wallet.
   * SUM(credit amounts) - SUM(debit amounts).
   * Used by reconciliation to compare against cached balance.
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
      if (row.type === 'CASHBACK') {
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
