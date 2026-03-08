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

## Session Handover (2026-02-21)
### Confirmed Working
1. End-to-end invoice + payment flow works in n8n with batch splitting (`batchSize = 1`).
2. Melbourne-local day filtering is required for all BigQuery date logic:
   - `DATE(timestamp_col, 'Australia/Melbourne')`
3. Xero invoice creation requires:
   - `DueDate` present
   - valid line `TaxType` (`OUTPUT` used successfully)
4. Xero payment posting requires valid payment-capable account mapping per method/bucket.

### Current Payment Mapping Decision
1. `payment_method = Bank Transfer` -> account code `601`.
2. Fresha terminal payments -> account code `140` (after enabling payments to this account in Xero).
3. Cash -> account code `812`.
4. Gift voucher redemption -> account code `813`.
5. Deposit redemption -> account code `814`.

### Next Build Items
1. Product vs service revenue mapping:
   - route product lines to product revenue accounts
   - route service lines to service revenue accounts
2. Merchant fee handling for Fresha terminal settlements:
   - if invoice/receipt gross exceeds actual settlement deposit, post merchant fee difference to fee expense account
   - reconcile `140` clearing against net settlement amount
3. Keep idempotency strict:
   - dedupe by `payment_no`
   - skip already-synced audit keys

## Session Handover (2026-02-22)
### Production Workflow Status
1. The nightly invoice + payment workflow in n8n is confirmed working and remains the active production path.
2. Invoices are created from non-void, non-cancelled sales only, with Melbourne-local day filtering.
3. Payments are created per payment row with account mapping by method/bucket:
   - Cash -> `812`
   - Bank Transfer -> `601`
   - Fresha terminal/card/eftpos -> `140`
   - Gift voucher redemption -> `813`
   - Deposit redemption -> `814`
4. Overpayment protection is enabled by capping applied payment amount to Xero invoice `AmountDue`.

### Service Charge / Merchant Fee Decision
1. Service charges are not included in invoice line creation for the active receipts workflow.
2. Merchant fee auto-posting is not active in production.
3. Fee journaling remains in a separate draft n8n workflow for future use only:
   - `/Users/markgraham/Desktop/WF - Fresha Settlement Surcharges.json`
4. Current operating policy: do not post surcharge/fee journals until settlement-source process is finalized and approved.

### Data and Audit Notes
1. `voi_warehouse.service_charges` is available and used for surcharge reporting/analysis.
2. `voi_ops.surcharge_daily_audit` exists and can be retained as reporting support; it is not currently required for production fee posting.
3. If fee posting is re-enabled later, enforce idempotency with a dedicated posting audit table before activating schedule.
