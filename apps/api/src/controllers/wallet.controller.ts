import { Request, Response } from 'express'
import { asyncHandler } from '../utils/async-handler'
import type { WalletService } from '../services/wallet.service'
import type { WalletTransactionFilters } from '@shared/types/wallet.types'

export class WalletController {
  constructor(private walletService: WalletService) {}

  /** GET /wallet — returns wallet balance for authenticated user */
  getBalance = asyncHandler(async (req: Request, res: Response) => {
    const result = await this.walletService.getBalance(req.user!.userId)
    res.json({ success: true, data: result })
  })

  /** GET /wallet/transactions — paginated transaction history */
  getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const filters = req.query as WalletTransactionFilters
    const result = await this.walletService.getTransactionHistory(req.user!.userId, filters)
    res.json({ success: true, data: result.data, pagination: result.pagination })
  })

  /** POST /admin/wallets/:userId/credit — admin manual credit */
  adminCredit = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params
    const { amount, description } = req.body
    const result = await this.walletService.adminCredit(req.user!.userId, userId, amount, description)
    res.status(201).json({ success: true, data: result })
  })

  /** POST /admin/wallets/:userId/debit — admin manual debit */
  adminDebit = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params
    const { amount, description } = req.body
    const result = await this.walletService.adminDebit(req.user!.userId, userId, amount, description)
    res.status(201).json({ success: true, data: result })
  })
}
