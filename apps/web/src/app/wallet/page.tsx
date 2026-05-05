'use client'

import { useState } from 'react'
import { Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp } from 'lucide-react'
import { AuthGuard } from '@/components/shared/auth-guard'
import { ErrorState } from '@/components/shared/data-states'
import { useWalletBalance, useWalletTransactions } from '@/hooks/use-wallet'
import { WalletTransactionList } from '@/components/wallet/wallet-transaction-list'
import { WalletFilters } from '@/components/wallet/wallet-filters'
import { formatCurrency } from '@/lib/format'
import type { WalletTransactionType } from '@shared/types/wallet.types'

export default function WalletPage() {
  const [filterType, setFilterType] = useState<WalletTransactionType | undefined>()
  const [page, setPage] = useState(1)

  const balance = useWalletBalance()
  const transactions = useWalletTransactions({ type: filterType, page })

  return (
    <AuthGuard allowedRoles={['TRAVELER', 'ORGANIZER', 'ADMIN']}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-8 space-y-6">
        <h1 className="font-display text-xl font-bold text-neutral-900 md:text-2xl">
          My Wallet
        </h1>

        {/* Balance Card */}
        {balance.isLoading ? (
          <div className="skeleton h-36 rounded-2xl" />
        ) : balance.error ? (
          <ErrorState title="Failed to load wallet balance" message={balance.error?.message} onRetry={() => balance.refetch()} />
        ) : balance.data ? (
          <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-primary-600 to-primary-700 p-6 text-white shadow-lg md:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/20 p-3">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-100">Available Balance</p>
                <p className="font-mono text-3xl font-bold md:text-4xl">
                  {formatCurrency(balance.data.balance)}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <ArrowDownLeft className="h-3.5 w-3.5 text-success-300" />
                  <span className="text-xs text-primary-200">Credits</span>
                </div>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {formatCurrency(balance.data.totalCredits)}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <ArrowUpRight className="h-3.5 w-3.5 text-error-300" />
                  <span className="text-xs text-primary-200">Debits</span>
                </div>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {formatCurrency(balance.data.totalDebits)}
                </p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-highlight-300" />
                  <span className="text-xs text-primary-200">Cashback</span>
                </div>
                <p className="mt-1 font-mono text-sm font-semibold">
                  {formatCurrency(balance.data.totalCashback)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Transaction History Section */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-neutral-800">
            Transaction History
          </h2>

          {/* Type Filters */}
          <WalletFilters
            activeType={filterType}
            onTypeChange={(type) => {
              setFilterType(type)
              setPage(1)
            }}
          />

          {/* Transaction List — 4-state rendering */}
          <WalletTransactionList
            data={transactions.data?.data}
            pagination={transactions.data?.pagination}
            isLoading={transactions.isLoading}
            error={transactions.error}
            onRetry={() => transactions.refetch()}
            page={page}
            onPageChange={setPage}
          />
        </div>
      </div>
    </AuthGuard>
  )
}
