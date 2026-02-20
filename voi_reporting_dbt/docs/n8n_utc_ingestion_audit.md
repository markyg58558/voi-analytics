# n8n UTC Ingestion Audit (2026-02-20)

## Canonical Rule
- Store event timestamps in BigQuery as UTC `TIMESTAMP`.
- If source values are Melbourne local wall-clock (no timezone), convert on ingest with:
  - `TIMESTAMP(DATETIME(source_value), "Australia/Melbourne")`
- Do not re-convert on write after that.
- Convert to Melbourne only in reporting/query layers.

## Sub-workflow audit

### Updated and UTC-safe for event timestamps
- `WF – Sync Sales.json`
  - `SALE_DATE` converted in `UPDATE` and `INSERT`.
- `WF – Sync Sale Items.json`
  - `SALE_DATE` converted in `UPDATE` and `INSERT`.
- `WF – Sync Payments.json`
  - `PAYMENT_DATE`, `SALE_DATE` converted in `UPDATE` and `INSERT`.
- `WF – Sync Bookings.json`
  - `SCHEDULED_TIME`, `START_TIME`, `END_TIME` converted in `UPDATE` and `INSERT`.
- `WF – Sync Commissions.json`
  - `SALE_DATE` converted in `UPDATE` and `INSERT`.
- `WF – Sync Deposits.json`
  - `COLLECTION_DATE`, `REFUND_DATE`, `REDEMPTION_DATE` converted in `UPDATE` and `INSERT`.

### No timestamp conversion currently applied (verify source type before changing)
- `WF – Sync Clients.json`
  - Uses `SIGNUP_DATE`, `FIRST_APPOINTMENT_DATE`, `LAST_APPOINTMENT_DATE` as-is.
  - If these are true `DATE` values, this is correct.
- `WF – Sync Service Charges.json`
  - Uses `SERVICE_CHARGE_DATE` as-is.
  - If this is true `DATE`, this is correct.
- `WF – Sync Gift Cards.json`
  - Uses `ISSUE_DATE`, `EXPIRY_DATE`, `REDEMPTION_DATE` as-is.
  - If any are datetime/timestamp, apply timezone conversion.
- `WF – Sync Team Members.json`
  - Uses `EMPLOYMENT_START_DATE`, `EMPLOYMENT_END_DATE`, `DELETED_AT` as-is.
  - If `DELETED_AT` is local datetime/timestamp, apply timezone conversion.
- `WF – Sync Products.json`
  - No date/time fields in merge.

## Quick decision checklist for each field
- `DATE` only: keep as-is.
- `TIMESTAMP`/`DATETIME` local Melbourne: convert on ingest.
- Already true UTC timestamp from source: keep as-is (no conversion).
