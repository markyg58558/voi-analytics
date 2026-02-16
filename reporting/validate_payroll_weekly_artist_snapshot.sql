-- Validate current payroll snapshot load for the Melbourne pay week.
-- Run this in BigQuery after the snapshot load query.

DECLARE week_start DATE DEFAULT DATE_TRUNC(CURRENT_DATE("Australia/Melbourne"), WEEK(SATURDAY));

-- 1) Snapshot quality checks for the loaded week
SELECT
  week_start AS expected_week_start,
  COUNT(*) AS row_count,
  COUNTIF(team_member IS NULL OR team_member = "") AS missing_team_member,
  COUNTIF(tattoo_commission_owed < 0) AS negative_commission_rows,
  COUNTIF(deposits_collected < 0) AS negative_deposit_collection_rows,
  COUNT(DISTINCT CONCAT(CAST(IFNULL(team_member_id, -1) AS STRING), "|", IFNULL(team_member, ""))) AS distinct_artists
FROM `victims-of-ink-data-platform.voi_reporting.payroll_weekly_artist_snapshot`
WHERE pay_week_start = week_start;

-- 2) Reconcile snapshot totals vs source totals for the same week
WITH src_tattoo AS (
  SELECT
    ROUND(SUM(IFNULL(COMMISSION_BASE, 0)), 2) AS src_tattoo_commission_base,
    ROUND(SUM(IFNULL(payout_total, 0)), 2) AS src_tattoo_commission_owed,
    COUNT(DISTINCT SALE_ID) AS src_tattoo_sales_count
  FROM `victims-of-ink-data-platform.voi_reporting.v_payroll_tattoo_lines`
  WHERE pay_week_start = week_start
),
src_deposit AS (
  SELECT
    ROUND(SUM(IFNULL(COLLECTIONS, 0)), 2) AS src_deposits_collected,
    ROUND(SUM(IFNULL(REDEMPTIONS, 0)), 2) AS src_deposits_redeemed,
    ROUND(SUM(IFNULL(REFUNDS, 0)), 2) AS src_deposits_refunded,
    COUNT(DISTINCT DEPOSIT_ID) AS src_deposit_txn_count
  FROM `victims-of-ink-data-platform.voi_warehouse.deposits`
  WHERE DATE_TRUNC(DATE(COLLECTION_DATE, "Australia/Melbourne"), WEEK(SATURDAY)) = week_start
),
snap AS (
  SELECT
    ROUND(SUM(IFNULL(tattoo_commission_base, 0)), 2) AS snap_tattoo_commission_base,
    ROUND(SUM(IFNULL(tattoo_commission_owed, 0)), 2) AS snap_tattoo_commission_owed,
    SUM(IFNULL(tattoo_sales_count, 0)) AS snap_tattoo_sales_count,
    ROUND(SUM(IFNULL(deposits_collected, 0)), 2) AS snap_deposits_collected,
    ROUND(SUM(IFNULL(deposits_redeemed, 0)), 2) AS snap_deposits_redeemed,
    ROUND(SUM(IFNULL(deposits_refunded, 0)), 2) AS snap_deposits_refunded,
    SUM(IFNULL(deposit_txn_count, 0)) AS snap_deposit_txn_count
  FROM `victims-of-ink-data-platform.voi_reporting.payroll_weekly_artist_snapshot`
  WHERE pay_week_start = week_start
)
SELECT
  week_start AS expected_week_start,
  src_tattoo.src_tattoo_commission_base,
  snap.snap_tattoo_commission_base,
  src_tattoo.src_tattoo_commission_owed,
  snap.snap_tattoo_commission_owed,
  src_tattoo.src_tattoo_sales_count,
  snap.snap_tattoo_sales_count,
  src_deposit.src_deposits_collected,
  snap.snap_deposits_collected,
  src_deposit.src_deposits_redeemed,
  snap.snap_deposits_redeemed,
  src_deposit.src_deposits_refunded,
  snap.snap_deposits_refunded,
  src_deposit.src_deposit_txn_count,
  snap.snap_deposit_txn_count,
  -- quick pass/fail flags
  (IFNULL(src_tattoo.src_tattoo_commission_base, 0) = IFNULL(snap.snap_tattoo_commission_base, 0)) AS ok_tattoo_commission_base,
  (IFNULL(src_tattoo.src_tattoo_commission_owed, 0) = IFNULL(snap.snap_tattoo_commission_owed, 0)) AS ok_tattoo_commission_owed,
  (IFNULL(src_tattoo.src_tattoo_sales_count, 0) = IFNULL(snap.snap_tattoo_sales_count, 0)) AS ok_tattoo_sales_count,
  (IFNULL(src_deposit.src_deposits_collected, 0) = IFNULL(snap.snap_deposits_collected, 0)) AS ok_deposits_collected,
  (IFNULL(src_deposit.src_deposits_redeemed, 0) = IFNULL(snap.snap_deposits_redeemed, 0)) AS ok_deposits_redeemed,
  (IFNULL(src_deposit.src_deposits_refunded, 0) = IFNULL(snap.snap_deposits_refunded, 0)) AS ok_deposits_refunded,
  (IFNULL(src_deposit.src_deposit_txn_count, 0) = IFNULL(snap.snap_deposit_txn_count, 0)) AS ok_deposit_txn_count
FROM src_tattoo
CROSS JOIN src_deposit
CROSS JOIN snap;
