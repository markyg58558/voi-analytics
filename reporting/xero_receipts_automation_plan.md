# Xero Receipts Automation Plan

## Goal
At 11:00 PM Australia/Melbourne each day, sync Fresha sales to Xero as invoices and immediately mark them paid so they behave like receipts.

## Source Tables
- `voi_warehouse.sales`: sale header, status, totals.
- `voi_warehouse.sale_items`: invoice line detail.
- `voi_warehouse.payments`: payment method, payment amount, redemption flags.
- `voi_warehouse.deposits`: supporting liability logic and reconciliation checks.

## Accounting Treatment
- Create one Xero invoice per Fresha sale (`sale_id` / `sale_number`).
- Create one or more Xero payments per invoice from Fresha payment rows.
- Route Xero payment account by clearing bucket:
  - `fresha_eftpos_clearing`
  - `deposits_clearing`
  - `gift_voucher_clearing`

## Bucket Mapping Rules
1. If `is_gift_card_redemption = true` -> `gift_voucher_clearing`.
2. Else if `is_deposit_redemption = true` -> `deposits_clearing`.
3. Else if payment method contains `eftpos` or `card` -> `fresha_eftpos_clearing`.
4. Else fallback -> `fresha_eftpos_clearing`.

## Eligibility Rules
1. Sale day is the run day in `Australia/Melbourne`.
2. Exclude `cancelled` / `void` sales.
3. Include sales where `total_sales > 0`.
4. Mark as paid only when summed `payment_amount >= total_sales`.

## Idempotency
Persist sync audit rows per sale/payment in `voi_ops`:
- `sale_id`
- `payment_no`
- `xero_invoice_id`
- `xero_payment_id`
- `synced_at`

On rerun, skip any row already present in the audit table.

## Operational Sequence (Nightly)
1. Trigger at 23:00 local time.
2. Read payload query from `reporting/xero_receipts_nightly_payload.sql`.
3. Group rows into:
   - invoice headers
   - invoice lines
   - invoice payments
4. Upsert invoice in Xero.
5. Create payment(s) in Xero for that invoice.
6. Write audit rows to `voi_ops`.
7. Send run summary: sales count, invoice total, payment total, failures.

## Open Items Before Production
1. Confirm Xero tax code mapping per `sale_items.category` and `sale_items.sale_type`.
2. Confirm contact strategy in Xero (`Walk-in Receipts` contact vs client-level contacts).
3. Decide handling for partial payments and overpayments.
4. Add refund handling path (credit note vs negative payment).
