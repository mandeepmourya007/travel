/**
 * FEATURE BRIEF: In-App Wallet
 * ==================================
 * 1. What:      Wallet for refunds, cashback, booking deductions, and admin credits
 * 2. Who:       Traveler (own wallet), Admin (any wallet)
 * 3. Why:       Instant refunds (vs 5-7 days bank), platform money retention, cashback loyalty
 *
 * 4. API Endpoints:
 *    GET  /api/v1/wallet                          — balance + summary
 *    GET  /api/v1/wallet/transactions             — paginated history
 *    GET  /api/v1/admin/wallets/:userId           — admin view user wallet
 *    POST /api/v1/admin/wallets/:userId/credit    — admin manual credit
 *    POST /api/v1/admin/wallets/:userId/debit     — admin manual debit
 *
 * 5. DB Tables:  Wallet, WalletTransaction (new), User (relation), Booking (walletAmount)
 * 6. Validations: amount > 0, balance >= debit, type matches credit/debit direction
 * 7. Error Cases: Wallet not found (404), insufficient balance (400), duplicate txn (409)
 * 8. Side Effects: Balance atomically updated, WalletTransaction created
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalletService } from '../../../src/services/wallet.service'
import { logger } from '../../../src/utils/logger'

// ─── Mock repositories ──────────────────────────────
const mockWalletRepo = {
  findByUserId: vi.fn(),
  findOrCreate: vi.fn(),
  create: vi.fn(),
  atomicCredit: vi.fn(),
  atomicDebit: vi.fn(),
  getBalance: vi.fn(),
  getWalletStats: vi.fn(),
  findTransactions: vi.fn(),
  countTransactions: vi.fn(),
  findAll: vi.fn(),
  sumByDirection: vi.fn(),
  sumByDirectionBatch: vi.fn(),
  findCashbackTransactionsEnriched: vi.fn(),
}

let service: WalletService

beforeEach(() => {
  vi.clearAllMocks()
  service = new WalletService(
    mockWalletRepo as any,
    logger as any,
  )
})

// ─── Test data factories ─────────────────────────────
function makeWallet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wallet_1',
    userId: 'user_1',
    balance: 1000,
    currency: 'INR',
    isActive: true,
    isDeleted: false,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    deletedAt: null,
    ...overrides,
  }
}

function makeWalletTxn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wtx_1',
    walletId: 'wallet_1',
    amount: 500,
    type: 'REFUND',
    referenceModel: 'Booking',
    referenceId: 'booking_1',
    description: 'Refund for booking #TRP-2025-0001',
    balanceBefore: 1000,
    balanceAfter: 1500,
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════
// credit()
// ═════════════════════════════════════════════════════
describe('WalletService', () => {
  describe('credit', () => {
    it('should credit wallet and return transaction when input is valid', async () => {
      const wallet = makeWallet()
      const txn = makeWalletTxn({ balanceBefore: 1000, balanceAfter: 1500, amount: 500 })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicCredit.mockResolvedValue({ wallet: { ...wallet, balance: 1500 }, transaction: txn })

      const result = await service.credit({
        userId: 'user_1',
        amount: 500,
        type: 'REFUND',
        referenceModel: 'Booking',
        referenceId: 'booking_1',
        description: 'Refund for booking #TRP-2025-0001',
      })

      expect(result.amount).toBe(500)
      expect(result.balanceAfter).toBe(1500)
      expect(mockWalletRepo.atomicCredit).toHaveBeenCalledWith(
        'wallet_1',
        500,
        expect.objectContaining({ type: 'REFUND', referenceModel: 'Booking' }),
      )
    })

    it('should throw NotFoundError when wallet does not exist', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.credit({
          userId: 'nonexistent',
          amount: 500,
          type: 'REFUND',
          description: 'Refund',
        }),
      ).rejects.toThrow('Wallet not found')
    })

    it('should throw ValidationError when amount is zero', async () => {
      await expect(
        service.credit({
          userId: 'user_1',
          amount: 0,
          type: 'REFUND',
          description: 'Refund',
        }),
      ).rejects.toThrow()
    })

    it('should throw ValidationError when amount is negative', async () => {
      await expect(
        service.credit({
          userId: 'user_1',
          amount: -100,
          type: 'REFUND',
          description: 'Refund',
        }),
      ).rejects.toThrow()
    })

    it('should throw ValidationError when type is a debit type', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(makeWallet())

      await expect(
        service.credit({
          userId: 'user_1',
          amount: 500,
          type: 'BOOKING_DEDUCTION',
          description: 'Wrong type',
        }),
      ).rejects.toThrow()
    })

    it('should log credit event at info level', async () => {
      const wallet = makeWallet()
      const txn = makeWalletTxn()
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicCredit.mockResolvedValue({ wallet: { ...wallet, balance: 1500 }, transaction: txn })
      const logSpy = vi.spyOn(logger, 'info')

      await service.credit({
        userId: 'user_1',
        amount: 500,
        type: 'REFUND',
        description: 'Refund',
      })

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ walletId: 'wallet_1', amount: 500 }),
        expect.stringContaining('Wallet credited'),
      )
    })
  })

  // ═════════════════════════════════════════════════════
  // debit()
  // ═════════════════════════════════════════════════════
  describe('debit', () => {
    it('should debit wallet and return transaction when balance is sufficient', async () => {
      const wallet = makeWallet({ balance: 1000 })
      const txn = makeWalletTxn({
        type: 'BOOKING_DEDUCTION',
        amount: 700,
        balanceBefore: 1000,
        balanceAfter: 300,
      })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicDebit.mockResolvedValue({ wallet: { ...wallet, balance: 300 }, transaction: txn })

      const result = await service.debit({
        userId: 'user_1',
        amount: 700,
        type: 'BOOKING_DEDUCTION',
        referenceModel: 'Booking',
        referenceId: 'booking_2',
        description: 'Wallet deduction for booking',
      })

      expect(result.amount).toBe(700)
      expect(result.balanceAfter).toBe(300)
      expect(mockWalletRepo.atomicDebit).toHaveBeenCalledWith(
        'wallet_1',
        700,
        expect.objectContaining({ type: 'BOOKING_DEDUCTION' }),
      )
    })

    it('should throw NotFoundError when wallet does not exist', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.debit({
          userId: 'nonexistent',
          amount: 500,
          type: 'BOOKING_DEDUCTION',
          description: 'Debit',
        }),
      ).rejects.toThrow('Wallet not found')
    })

    it('should throw ValidationError when balance is insufficient', async () => {
      const wallet = makeWallet({ balance: 100 })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicDebit.mockResolvedValue(null)

      await expect(
        service.debit({
          userId: 'user_1',
          amount: 500,
          type: 'BOOKING_DEDUCTION',
          description: 'Debit',
        }),
      ).rejects.toThrow('Insufficient wallet balance')
    })

    it('should throw ValidationError when amount is zero', async () => {
      await expect(
        service.debit({
          userId: 'user_1',
          amount: 0,
          type: 'BOOKING_DEDUCTION',
          description: 'Debit',
        }),
      ).rejects.toThrow()
    })

    it('should throw ValidationError when type is a credit type', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(makeWallet())

      await expect(
        service.debit({
          userId: 'user_1',
          amount: 500,
          type: 'REFUND',
          description: 'Wrong type',
        }),
      ).rejects.toThrow()
    })

    it('should debit exact balance (edge: balance === amount)', async () => {
      const wallet = makeWallet({ balance: 500 })
      const txn = makeWalletTxn({
        type: 'BOOKING_DEDUCTION',
        amount: 500,
        balanceBefore: 500,
        balanceAfter: 0,
      })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicDebit.mockResolvedValue({ wallet: { ...wallet, balance: 0 }, transaction: txn })

      const result = await service.debit({
        userId: 'user_1',
        amount: 500,
        type: 'BOOKING_DEDUCTION',
        description: 'Full debit',
      })

      expect(result.balanceAfter).toBe(0)
    })
  })

  // ═════════════════════════════════════════════════════
  // getBalance()
  // ═════════════════════════════════════════════════════
  describe('getBalance', () => {
    it('should return wallet balance and summary for valid user', async () => {
      const wallet = makeWallet({ balance: 2500 })
      mockWalletRepo.findOrCreate.mockResolvedValue(wallet)
      mockWalletRepo.getWalletStats.mockResolvedValue({ totalCredits: 3500, totalDebits: 1000, totalCashback: 225 })

      const result = await service.getBalance('user_1')

      expect(result.balance).toBe(2500)
      expect(result.currency).toBe('INR')
      expect(result.id).toBe('wallet_1')
      expect(result.totalCredits).toBe(3500)
      expect(result.totalDebits).toBe(1000)
      expect(result.totalCashback).toBe(225)
    })

    it('should auto-create wallet when none exists and return zero balance', async () => {
      const newWallet = makeWallet({ balance: 0 })
      mockWalletRepo.findOrCreate.mockResolvedValue(newWallet)
      mockWalletRepo.getWalletStats.mockResolvedValue({ totalCredits: 0, totalDebits: 0, totalCashback: 0 })

      const result = await service.getBalance('new_user')

      expect(result.balance).toBe(0)
      expect(mockWalletRepo.findOrCreate).toHaveBeenCalledWith('new_user')
    })
  })

  // ═════════════════════════════════════════════════════
  // getTransactionHistory()
  // ═════════════════════════════════════════════════════
  describe('getTransactionHistory', () => {
    it('should return paginated transactions for valid user', async () => {
      const wallet = makeWallet()
      const txns = [makeWalletTxn(), makeWalletTxn({ id: 'wtx_2' })]
      mockWalletRepo.findOrCreate.mockResolvedValue(wallet)
      mockWalletRepo.findTransactions.mockResolvedValue(txns)
      mockWalletRepo.countTransactions.mockResolvedValue(2)

      const result = await service.getTransactionHistory('user_1', { page: 1, limit: 20 })

      expect(result.data).toHaveLength(2)
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.page).toBe(1)
    })

    it('should auto-create wallet and return empty transactions for new user', async () => {
      const newWallet = makeWallet({ balance: 0 })
      mockWalletRepo.findOrCreate.mockResolvedValue(newWallet)
      mockWalletRepo.findTransactions.mockResolvedValue([])
      mockWalletRepo.countTransactions.mockResolvedValue(0)

      const result = await service.getTransactionHistory('new_user', { page: 1, limit: 20 })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(mockWalletRepo.findOrCreate).toHaveBeenCalledWith('new_user')
    })

    it('should return empty array when no transactions exist', async () => {
      const wallet = makeWallet()
      mockWalletRepo.findOrCreate.mockResolvedValue(wallet)
      mockWalletRepo.findTransactions.mockResolvedValue([])
      mockWalletRepo.countTransactions.mockResolvedValue(0)

      const result = await service.getTransactionHistory('user_1', { page: 1, limit: 20 })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })

    it('should filter by transaction type when provided', async () => {
      const wallet = makeWallet()
      mockWalletRepo.findOrCreate.mockResolvedValue(wallet)
      mockWalletRepo.findTransactions.mockResolvedValue([makeWalletTxn()])
      mockWalletRepo.countTransactions.mockResolvedValue(1)

      await service.getTransactionHistory('user_1', { type: 'REFUND', page: 1, limit: 20 })

      expect(mockWalletRepo.findTransactions).toHaveBeenCalledWith(
        'wallet_1',
        expect.objectContaining({ type: 'REFUND' }),
        expect.any(Object),
      )
    })

    it('should filter by date range when provided', async () => {
      const wallet = makeWallet()
      mockWalletRepo.findOrCreate.mockResolvedValue(wallet)
      mockWalletRepo.findTransactions.mockResolvedValue([])
      mockWalletRepo.countTransactions.mockResolvedValue(0)

      await service.getTransactionHistory('user_1', {
        fromDate: '2025-01-01',
        toDate: '2025-01-31',
        page: 1,
        limit: 20,
      })

      expect(mockWalletRepo.findTransactions).toHaveBeenCalledWith(
        'wallet_1',
        expect.objectContaining({ fromDate: '2025-01-01', toDate: '2025-01-31' }),
        expect.any(Object),
      )
    })
  })

  // ═════════════════════════════════════════════════════
  // adminCredit()
  // ═════════════════════════════════════════════════════
  describe('adminCredit', () => {
    it('should credit target user wallet and return transaction', async () => {
      const wallet = makeWallet({ userId: 'target_user' })
      const txn = makeWalletTxn({ type: 'ADMIN_CREDIT', amount: 500, balanceAfter: 1500 })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicCredit.mockResolvedValue({ wallet: { ...wallet, balance: 1500 }, transaction: txn })

      const result = await service.adminCredit('admin_1', 'target_user', 500, 'Compensation for issue')

      expect(result.amount).toBe(500)
      expect(result.type).toBe('ADMIN_CREDIT')
      expect(mockWalletRepo.atomicCredit).toHaveBeenCalledWith(
        'wallet_1',
        500,
        expect.objectContaining({
          type: 'ADMIN_CREDIT',
          referenceModel: 'AdminAction',
          referenceId: 'admin_1',
        }),
      )
    })

    it('should throw NotFoundError when target user wallet does not exist', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.adminCredit('admin_1', 'nonexistent', 500, 'Credit'),
      ).rejects.toThrow('Wallet not found')
    })

    it('should throw ValidationError when amount exceeds max admin credit', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(makeWallet())

      await expect(
        service.adminCredit('admin_1', 'user_1', 100000, 'Too much'),
      ).rejects.toThrow()
    })

    it('should log admin credit with admin userId', async () => {
      const wallet = makeWallet()
      const txn = makeWalletTxn({ type: 'ADMIN_CREDIT' })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicCredit.mockResolvedValue({ wallet, transaction: txn })
      const logSpy = vi.spyOn(logger, 'info')

      await service.adminCredit('admin_1', 'user_1', 500, 'Compensation')

      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ adminUserId: 'admin_1' }),
        expect.stringContaining('Admin wallet credit'),
      )
    })
  })

  // ═════════════════════════════════════════════════════
  // adminDebit()
  // ═════════════════════════════════════════════════════
  describe('adminDebit', () => {
    it('should debit target user wallet and return transaction', async () => {
      const wallet = makeWallet({ userId: 'target_user', balance: 2000 })
      const txn = makeWalletTxn({ type: 'ADMIN_DEBIT', amount: 500, balanceBefore: 2000, balanceAfter: 1500 })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicDebit.mockResolvedValue({ wallet: { ...wallet, balance: 1500 }, transaction: txn })

      const result = await service.adminDebit('admin_1', 'target_user', 500, 'Fraud clawback')

      expect(result.amount).toBe(500)
      expect(result.type).toBe('ADMIN_DEBIT')
      expect(mockWalletRepo.atomicDebit).toHaveBeenCalledWith(
        'wallet_1',
        500,
        expect.objectContaining({
          type: 'ADMIN_DEBIT',
          referenceModel: 'AdminAction',
          referenceId: 'admin_1',
        }),
      )
    })

    it('should throw NotFoundError when target user wallet does not exist', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(null)

      await expect(
        service.adminDebit('admin_1', 'nonexistent', 500, 'Debit'),
      ).rejects.toThrow('Wallet not found')
    })

    it('should throw ValidationError when balance is insufficient', async () => {
      const wallet = makeWallet({ balance: 100 })
      mockWalletRepo.findByUserId.mockResolvedValue(wallet)
      mockWalletRepo.atomicDebit.mockResolvedValue(null)

      await expect(
        service.adminDebit('admin_1', 'user_1', 500, 'Debit'),
      ).rejects.toThrow('Insufficient wallet balance')
    })

    it('should throw ValidationError when amount exceeds max admin debit', async () => {
      mockWalletRepo.findByUserId.mockResolvedValue(makeWallet({ balance: 100000 }))

      await expect(
        service.adminDebit('admin_1', 'user_1', 100000, 'Too much'),
      ).rejects.toThrow()
    })
  })

  // ═════════════════════════════════════════════════
  // getCashbackHistory()
  // ═════════════════════════════════════════════════
  describe('getCashbackHistory', () => {
    it('returns paginated cashback transactions with trip names', async () => {
      const wallet = makeWallet()
      const cashbackTxns = [
        makeWalletTxn({ type: 'CASHBACK', amount: 200, tripName: 'Goa Beach' }),
        makeWalletTxn({ id: 'wtx_2', type: 'CASHBACK', amount: 300, tripName: 'Manali Trek' }),
      ]
      mockWalletRepo.findOrCreate.mockResolvedValue(wallet)
      mockWalletRepo.findCashbackTransactionsEnriched.mockResolvedValue({ data: cashbackTxns, total: 2 })

      const result = await service.getCashbackHistory('user_1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(2)
      expect(result.data[0].tripName).toBe('Goa Beach')
      expect(result.pagination.total).toBe(2)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(10)
      expect(mockWalletRepo.findCashbackTransactionsEnriched).toHaveBeenCalledWith(
        'wallet_1',
        { skip: 0, take: 10 },
      )
    })

    it('uses PAGINATION_DEFAULTS when no filters provided', async () => {
      mockWalletRepo.findOrCreate.mockResolvedValue(makeWallet())
      mockWalletRepo.findCashbackTransactionsEnriched.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getCashbackHistory('user_1', {})

      expect(result.pagination.page).toBe(1)
      expect(result.pagination.limit).toBe(20)
      expect(mockWalletRepo.findCashbackTransactionsEnriched).toHaveBeenCalledWith(
        'wallet_1',
        { skip: 0, take: 20 },
      )
    })

    it('auto-creates wallet for new user and returns empty', async () => {
      mockWalletRepo.findOrCreate.mockResolvedValue(makeWallet({ balance: 0 }))
      mockWalletRepo.findCashbackTransactionsEnriched.mockResolvedValue({ data: [], total: 0 })

      const result = await service.getCashbackHistory('new_user', { page: 1 })

      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
      expect(mockWalletRepo.findOrCreate).toHaveBeenCalledWith('new_user')
    })

    it('computes correct offset for page 3', async () => {
      mockWalletRepo.findOrCreate.mockResolvedValue(makeWallet())
      mockWalletRepo.findCashbackTransactionsEnriched.mockResolvedValue({ data: [], total: 55 })

      const result = await service.getCashbackHistory('user_1', { page: 3, limit: 10 })

      expect(mockWalletRepo.findCashbackTransactionsEnriched).toHaveBeenCalledWith(
        'wallet_1',
        { skip: 20, take: 10 },
      )
      expect(result.pagination.totalPages).toBe(6)
    })

    it('returns correct totalPages for exact division', async () => {
      mockWalletRepo.findOrCreate.mockResolvedValue(makeWallet())
      mockWalletRepo.findCashbackTransactionsEnriched.mockResolvedValue({ data: [], total: 40 })

      const result = await service.getCashbackHistory('user_1', { page: 1, limit: 20 })

      expect(result.pagination.totalPages).toBe(2)
    })
  })

  // ═════════════════════════════════════════════════════
  // reconcile()
  // ═════════════════════════════════════════════════════
  describe('reconcile', () => {
    it('should return zero drift when all wallets are consistent', async () => {
      const wallets = [
        makeWallet({ id: 'w1', balance: 1000 }),
        makeWallet({ id: 'w2', balance: 500 }),
      ]
      mockWalletRepo.findAll.mockResolvedValue(wallets)
      // sumByDirectionBatch returns a Map<walletId, computed>
      mockWalletRepo.sumByDirectionBatch.mockResolvedValue(new Map([['w1', 1000], ['w2', 500]]))

      const result = await service.reconcile()

      expect(result.checked).toBe(2)
      expect(result.drifted).toBe(0)
    })

    it('should detect drift and log error when cached != computed', async () => {
      const wallets = [
        makeWallet({ id: 'w1', balance: 1000 }),
        makeWallet({ id: 'w2', balance: 999 }),
      ]
      mockWalletRepo.findAll.mockResolvedValue(wallets)
      // w2 drift: cached=999, computed=500
      mockWalletRepo.sumByDirectionBatch.mockResolvedValue(new Map([['w1', 1000], ['w2', 500]]))
      const logSpy = vi.spyOn(logger, 'error')

      const result = await service.reconcile()

      expect(result.checked).toBe(2)
      expect(result.drifted).toBe(1)
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ walletId: 'w2' }),
        expect.stringContaining('Wallet balance drift'),
      )
    })

    it('should return zero checked when no wallets exist', async () => {
      mockWalletRepo.findAll.mockResolvedValue([])
      mockWalletRepo.sumByDirectionBatch.mockResolvedValue(new Map())

      const result = await service.reconcile()

      expect(result.checked).toBe(0)
      expect(result.drifted).toBe(0)
    })
  })
})
