# Organizer Working Capital vs. Refund Window — Industry Research

How established tour/travel marketplaces reconcile two conflicting needs — organizers/operators need cash **before** the trip to prepay hotels/transport/vendors, while platforms need to guarantee customer refunds **without clawing back money already paid out** — and how that research shaped Safarnama's staged deposit/balance payout model (see [[Payments & Webhooks]], [[Product Domain#Organizer Deposit / Balance Payout]]).

---

## 1. TourRadar — Net Release

TourRadar (multi-day tour marketplace) holds customer funds with a third-party payments provider and auto-splits/releases the operator's net payout via the "TourRadar Wallet," timed to **booking due dates** rather than an arbitrary or delayed schedule — no drip-feeding, no minimum thresholds, no rolling/fixed reserve held back. The explicit pitch to operators is predictable cash flow: payments release in line with when the booking's balance is actually due, not after the trip completes.

This is the direct precedent for releasing money to the organizer **before trip completion** rather than only on a post-trip escrow release (which is what Safarnama's existing Razorpay `ESCROW_RELEASE`/SafePay path does) — it validates that a marketplace can pay operators early **and** stay protected, as long as the release is tied to a point where the platform's refund exposure is already bounded.

Sources: [TourRadar Payments](https://www.tourradar.com/payments) · [How Are Payments Made by Travelers? (Operator Help Center)](https://help.tourradar.com/en/operators/how-are-payments-made-by-travelers) · [What Is TourRadar's Commission (Platform Service Fee)?](https://help.tourradar.com/en/operators/what-is-tourradars-commission-and-service-fee)

## 2. G Adventures — Non-Refundable Deposit Norm

G Adventures (large-scale small-group tour operator) charges a **non-refundable deposit per person at booking** (typically $250–350 USD depending on tour type), with the balance due 60 days before departure (90 days for Expedition Trips; full payment upfront if booking inside that window). Cancellation refunds scale down the closer to departure: full remainder refunded ≥60 days out, 50% of the remainder at 30–59 days, and nothing under 30 days. Notably, the "non-refundable" deposit isn't forfeited outright — it converts to a **Lifetime Deposit** usable on a future booking, softening the customer-facing harshness of a strict non-refundable term.

This is the direct precedent for Safarnama's core mechanic: **a deposit tranche that is never given back to the customer under any cancellation scenario**, funding the operator's pre-departure vendor prepayments (buses, hotels, permits) while the remaining balance stays refundable up to a cutoff. G Adventures' tiered cutoff (60/30 day cliffs) is the same shape as Safarnama's single 7-day cliff, scaled to a shorter domestic-trip cycle.

Sources: [US Booking Terms & Conditions | G Adventures](https://www.gadventures.com/terms-conditions/booking-terms/) · [Lifetime Deposits | G Adventures](https://www.gadventures.com/about-us/lifetime-deposits/) · [G Adventures: Payments & Refunds](https://www.tourvacationstogo.com/payrefund.cfm?op=GA)

## 3. TBO.com — B2B Travel Credit Line

TBO (a large India-based B2B travel distribution platform for agents/hoteliers/wholesalers) solves the same working-capital problem from the opposite direction: instead of releasing platform-collected customer money early, it extends **credit facilities** to its B2B buyers (bank guarantees, floating deposits used to open a credit line) so agents can book flights/hotels/packages against a running balance rather than prepaying every transaction, invoiced on the voucher date. Payment methods span bank transfer, credit card, net banking, and multi-currency settlement.

This is a different mechanism (extending credit vs. releasing a deposit) but the same underlying problem statement — travel supply chains are cash-flow constrained and B2B/B2B2C platforms compete partly on how fast/flexibly they let downstream partners access working capital. It reinforces that working-capital pressure is an industry-wide, not Safarnama-specific, problem worth solving deliberately rather than defaulting to "pay everyone only after the trip."

Sources: [TBO Platform](https://www.tbo.com/tbo-Platform) · [TBO Holidays | B2B Hotel Booking Portal](https://www.tboholidays.com/agent-partners.aspx) · [TBO.com Terms and Conditions](https://www.tbo.com/terms-and-conditions)

## 4. Cashfree Easy Split — Deferred Settlement Primitive

Cashfree's Easy Split (the gateway feature Safarnama already integrates for Cashfree bookings) supports vendor settlement scheduling as a first-class API concept: `schedule_option` values control the settlement cycle (e.g. option ID 1 = "T+1 settlement at 11:00 AM"), an order-level **split delay** window (T+1 days by default) during which split details can still be attached, and a separate **Deferred Settlement** API that assigns an explicit settlement-eligibility date per order+vendor combination, holding funds until that date rather than auto-releasing on the standard cycle.

This is the technical enabler, not just a policy precedent: it means the deposit/balance split doesn't require inventing custom escrow logic from scratch — the deposit rides on the order's `order_splits[]` at creation (settling on the normal T+1 cycle), and the balance can be released later via an on-demand vendor transfer call, which is exactly the two-call shape (`releaseDeposit` / `releaseBalance`) implemented in `PayoutService`.

Sources: [Easy Split FAQs | Cashfree Payments](https://www.cashfree.com/docs/help/easy-split/faqs/faqs) · [Order Split Delay Post Successful Payment](https://www.cashfree.com/docs/payments/split/settlements/delay/order-level) · [Defer Settlement](https://www.cashfree.com/docs/payments/split/settlements/delay/vendor-level)

---

## Conclusion — Non-Refundable Deposit Model Adopted

The pattern across all four is consistent: **split the payout into a non-refundable/immediately-available tranche and a held tranche**, size the non-refundable tranche so it never exceeds what the platform is guaranteed to retain even under the worst-case refund, and use whatever settlement primitive the payment stack already offers (Cashfree Easy Split here) rather than building bespoke escrow.

This directly shaped Safarnama's implementation:

- **Non-refundable deposit** (`ORGANIZER_DEPOSIT_PERCENT = 50%` of organizer entitlement) released to the organizer immediately at booking — mirrors G Adventures' non-refundable-deposit norm and rides on Cashfree's `order_splits[]` at order creation (Cashfree's standard T+1 settlement cycle).
- **Balance held and released early relative to trip completion** — released at the 7-day refund cliff (not after the trip ends), following TourRadar's Net Release philosophy of tying release timing to when the platform's refund exposure is bounded, rather than defaulting to a post-trip-only release.
- **Refund policy redefined as a single 7-day/50%/0% cliff** (replacing the old 48h/100-50-0 tiers) sized so the deposit percentage can never exceed the platform's guaranteed-retained share — the same "cap the non-refundable tranche below the worst-case refund" invariant every operator above expresses through its own terms.
- **No bespoke escrow engineering** — the deposit/balance mechanics use Cashfree Easy Split's existing settlement/deferred-transfer primitives, the same category of tooling TBO's credit-line model and TourRadar's Wallet represent, just accessed via a payment gateway API instead of a custom ledger integration.

Related: [[Payments & Webhooks]] · [[Product Domain#Organizer Deposit / Balance Payout]] · [[Shared Package#Utils]]
