# Wallet Feature — Engineering Documentation

## 1. Overview

- **What:** In-app wallet for refunds, cashback, booking deductions, and admin credits
- **Who:** Travelers (own wallet), Admins (any user's wallet)
- **Why:** Instant refunds (vs 5-7 day bank transfers), platform money retention, cashback loyalty

## 2. Data Flow

```
/wallet (page.tsx)
  → useWalletBalance() hook
    → GET /api/v1/wallet
      → WalletController.getBalance
        → WalletService.getBalance
          → WalletRepository.findByUserId + getWalletStats
            → Wallet + WalletTransaction tables

  → useWalletTransactions(filters) hook
    → GET /api/v1/wallet/transactions?type=&page=&limit=
      → WalletController.getTransactions
        → WalletService.getTransactionHistory
          → WalletRepository.findTransactions + countTransactions
```

## 3. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/wallet` | Auth | Balance + totalCredits/totalDebits/totalCashback |
| GET | `/api/v1/wallet/transactions` | Auth + Zod | Paginated, filterable transaction history |
| POST | `/api/v1/wallet/admin/:userId/credit` | Auth + ADMIN | Admin manual credit |
| POST | `/api/v1/wallet/admin/:userId/debit` | Auth + ADMIN | Admin manual debit |

## 4. Business Rules

- Wallet balance is **never negative** — enforced at DB level (`balance >= amount` in WHERE)
- All amounts are **whole rupees** (positive integers)
- Credit types: `REFUND`, `CASHBACK`, `ADMIN_CREDIT`, `PROMOTIONAL_CREDIT`
- Debit types: `BOOKING_DEDUCTION`, `ADMIN_DEBIT`, `EXPIRY`
- Admin credit/debit capped at ₹50,000 per transaction (`WALLET_MAX_ADMIN_CREDIT/DEBIT`)
- Atomic balance updates via raw SQL `UPDATE ... SET balance = balance ± amount` (no read-then-write race)
- Every balance change creates a `WalletTransaction` with `balanceBefore` + `balanceAfter` audit trail
- `@@unique([type, referenceModel, referenceId])` prevents duplicate transactions for same event
- Reconciliation cron compares cached `wallet.balance` vs `SUM(credits) - SUM(debits)` — logs drift, no auto-fix

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Debit exact balance (balance === amount) | Succeeds, balanceAfter = 0 |
| Debit > balance | `ValidationError('Insufficient wallet balance')` — 400 |
| Credit with debit type | `ValidationError('Invalid credit type')` — 400 |
| Debit with credit type | `ValidationError('Invalid debit type')` — 400 |
| Amount = 0 or negative | `ValidationError('Amount must be a positive integer')` — 400 |
| Non-integer amount | `ValidationError` — 400 |
| Wallet not found | `NotFoundError('Wallet')` — 404 |
| Admin credit > ₹50,000 | `ValidationError` — 400 |
| Duplicate referenceModel+referenceId+type | DB unique constraint error |

## 6. Error Handling

| Error | HTTP Status | When |
|-------|-------------|------|
| `NotFoundError('Wallet')` | 404 | User has no wallet |
| `ValidationError` | 400 | Invalid amount, wrong type, insufficient balance, exceeds admin limit |
| `ForbiddenError` | 403 | Non-admin hits admin routes |
| `UnauthorizedError` | 401 | Missing/invalid JWT |

## 7. Test Coverage

### Backend — `apps/api/tests/unit/services/wallet.service.test.ts`

| describe | Covers |
|----------|--------|
| `credit` | Happy path, wallet not found, zero amount, negative amount, wrong type, logging |
| `debit` | Happy path, wallet not found, insufficient balance, zero amount, wrong type, exact balance edge |
| `getBalance` | Happy path with stats (totalCredits/totalDebits/totalCashback), wallet not found |
| `getTransactionHistory` | Pagination, empty list, type filter, date range filter, wallet not found |
| `adminCredit` | Happy path, wallet not found, exceeds max, logging |
| `adminDebit` | Happy path, wallet not found, insufficient balance, exceeds max |
| `reconcile` | Zero drift, drift detected + logging, no wallets |

### Frontend — Tests pending (H5 in review)

- `WalletTransactionList` — 4-state rendering (loading/error/empty/data)
- `WalletFilters` — filter toggle behavior
- `WalletTxTypeBadge` — correct label + color per type
- `WalletPage` — integration of balance + transactions
