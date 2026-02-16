# Victims Of Ink - Better Payroll Sheet (BigQuery-backed)

## Goal
Replace formula-heavy manual workbook tabs with a single Google Sheet backed by BigQuery views.

## What you already have
- Source warehouse tables in `voi_warehouse`
- This SQL file: `/Users/markgraham/Documents/New project/reporting/payroll_reporting_views.sql`
- Artist payout seed CSV: `/Users/markgraham/Documents/New project/reporting/artist_payout_config_seed.csv`

## Step 1: Build reporting views in BigQuery
1. Open BigQuery SQL editor.
2. Set Query settings -> Data location to `australia-southeast2`.
3. Run all SQL in `payroll_reporting_views.sql`.

## Step 2: Load artist payout config
1. In BigQuery, open table `voi_reporting.artist_payout_config`.
2. Use "Load data" and upload `artist_payout_config_seed.csv`.
3. The seed file already includes normalized names and boolean flags.
4. After load, run:

```sql
UPDATE `victims-of-ink-data-platform.voi_reporting.artist_payout_config`
SET updated_at = CURRENT_TIMESTAMP()
WHERE updated_at IS NULL;
```

## Step 3: Create the Google Sheet
Create one sheet with these tabs:
1. `Control`
2. `Weekly Summary`
3. `Tattoo Line Items`
4. `Deposit Line Items`

## Step 4: Connect BigQuery data (Connected Sheets)
1. Google Sheets -> Data -> Data connectors -> Connect to BigQuery.
2. Add these views as separate connected data sources:
- `voi_reporting.v_payroll_weekly_artist_summary`
- `voi_reporting.v_payroll_tattoo_lines`
- `voi_reporting.v_payroll_deposit_lines`

## Step 5: Build filters for payroll week
In `Control` tab set:
- B1: `Pay Week Start`
- C1: e.g. `2026-02-09`

Then apply filters in each connected table:
- `pay_week_start = Control!C1`

## Step 6: Output format (recommended)
`Weekly Summary` columns:
- team_member
- tattoo_count
- tattoo_commission_owed
- deposit_txn_count
- deposits_collected

`Tattoo Line Items` columns:
- sale_day, team_member, client, sale_number, sale_item, commission

`Deposit Line Items` columns:
- collection_day, team_member, client, deposit_id, collections, status

## Step 7: Weekly pay run process
1. Set week start in `Control!C1`.
2. Refresh connected data.
3. Export `Weekly Summary` and `Tattoo Line Items` to CSV/PDF.
4. Save a copy named `Payroll_YYYY-MM-DD_to_YYYY-MM-DD`.

## Why this is better than the old workbook
- No fragile cross-tab formulas.
- Consistent numbers directly from BigQuery.
- Faster weekly close and easier audit trail.
