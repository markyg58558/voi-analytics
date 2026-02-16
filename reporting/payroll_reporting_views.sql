-- Victims Of Ink payroll reporting layer (region: australia-southeast2, timezone: Australia/Melbourne, Saturday payroll week)
-- Run in BigQuery (Standard SQL)

CREATE SCHEMA IF NOT EXISTS `victims-of-ink-data-platform.voi_reporting`
OPTIONS(location="australia-southeast2");

-- 1) Artist payout config table (manual master data)
CREATE TABLE IF NOT EXISTS `victims-of-ink-data-platform.voi_reporting.artist_payout_config` (
  artist_name STRING,
  artist_name_normalized STRING,
  team_member_id INT64,
  commission_rate NUMERIC,
  gst_registered BOOL,
  active BOOL,
  abn STRING,
  updated_at TIMESTAMP
);

-- 2) Live tattoo line items used for payroll
CREATE OR REPLACE VIEW `victims-of-ink-data-platform.voi_reporting.v_payroll_tattoo_lines` AS
WITH c AS (
  SELECT
    DATE(SALE_DATE, 'Australia/Melbourne') AS sale_day,
    DATE_TRUNC(DATE(SALE_DATE, 'Australia/Melbourne'), WEEK(SATURDAY)) AS pay_week_start,
    DATE_ADD(DATE_TRUNC(DATE(SALE_DATE, 'Australia/Melbourne'), WEEK(SATURDAY)), INTERVAL 6 DAY) AS pay_week_end,
    COMMISSION_ID,
    SALE_ITEM_ID,
    SALE_ID,
    SALE_NUMBER,
    TEAM_MEMBER_ID,
    TEAM_MEMBER,
    LOWER(TRIM(TEAM_MEMBER)) AS team_member_norm,
    CLIENT_ID,
    CLIENT,
    LOCATION_ID,
    LOCATION,
    SALE_ITEM,
    SALE_TYPE,
    SERVICE_CATEGORY,
    SKU,
    COMMISSION_BASE,
    COMMISSION AS fresha_commission,
    CURRENCY_CODE
  FROM `victims-of-ink-data-platform.voi_warehouse.commissions`
  WHERE UPPER(IFNULL(SALE_TYPE, '')) NOT LIKE '%DEPOSIT%'
)
SELECT
  c.sale_day,
  c.pay_week_start,
  c.pay_week_end,
  c.COMMISSION_ID,
  c.SALE_ITEM_ID,
  c.SALE_ID,
  c.SALE_NUMBER,
  c.TEAM_MEMBER_ID,
  c.TEAM_MEMBER,
  c.team_member_norm,
  c.CLIENT_ID,
  c.CLIENT,
  c.LOCATION_ID,
  c.LOCATION,
  c.SALE_ITEM,
  c.SALE_TYPE,
  c.SERVICE_CATEGORY,
  c.SKU,
  c.COMMISSION_BASE,
  c.fresha_commission,
  c.CURRENCY_CODE,
  apc.commission_rate,
  IF(apc.commission_rate > 1, apc.commission_rate / 100, apc.commission_rate) AS commission_rate_decimal,
  apc.gst_registered,
  apc.abn,
  ROUND(IFNULL(c.COMMISSION_BASE, 0) * IFNULL(IF(apc.commission_rate > 1, apc.commission_rate / 100, apc.commission_rate), 0), 2) AS payout_ex_gst,
  ROUND(
    IF(apc.gst_registered, NUMERIC '0.10', NUMERIC '0')
    * IFNULL(c.COMMISSION_BASE, 0)
    * IFNULL(IF(apc.commission_rate > 1, apc.commission_rate / 100, apc.commission_rate), 0),
    2
  ) AS payout_gst,
  -- Payout owed is based on commission base * rate.
  -- GST registration is retained for reporting but is not added on top by default.
  ROUND(
    IFNULL(c.COMMISSION_BASE, 0) * IFNULL(IF(apc.commission_rate > 1, apc.commission_rate / 100, apc.commission_rate), 0),
    2
  ) AS payout_total,
  (apc.commission_rate IS NULL) AS missing_payout_config
FROM c
LEFT JOIN `victims-of-ink-data-platform.voi_reporting.artist_payout_config` apc
  ON IFNULL(apc.active, TRUE)
 AND (
      (apc.team_member_id IS NOT NULL AND c.TEAM_MEMBER_ID = apc.team_member_id)
      OR (apc.team_member_id IS NULL AND c.team_member_norm = apc.artist_name_normalized)
 )
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY c.COMMISSION_ID
  ORDER BY
    IF(apc.team_member_id IS NOT NULL AND c.TEAM_MEMBER_ID = apc.team_member_id, 0, 1),
    apc.updated_at DESC
) = 1;

-- 3) Live deposit line items used for payroll
CREATE OR REPLACE VIEW `victims-of-ink-data-platform.voi_reporting.v_payroll_deposit_lines` AS
SELECT
  DATE(COLLECTION_DATE, 'Australia/Melbourne') AS collection_day,
  DATE_TRUNC(DATE(COLLECTION_DATE, 'Australia/Melbourne'), WEEK(SATURDAY)) AS pay_week_start,
  DATE_ADD(DATE_TRUNC(DATE(COLLECTION_DATE, 'Australia/Melbourne'), WEEK(SATURDAY)), INTERVAL 6 DAY) AS pay_week_end,
  DEPOSIT_ID,
  APPOINTMENT_ID,
  APPOINTMENT_REF,
  TEAM_MEMBER_ID,
  TEAM_MEMBER,
  CLIENT_ID,
  CLIENT,
  LOCATION_ID,
  LOCATION,
  STATUS,
  COLLECTIONS,
  REDEMPTIONS,
  REFUNDS,
  CLOSING_BALANCE,
  CURRENCY_CODE
FROM `victims-of-ink-data-platform.voi_warehouse.deposits`;

-- 4) Weekly artist summary built from tattoo/deposit line views
CREATE OR REPLACE VIEW `victims-of-ink-data-platform.voi_reporting.v_payroll_weekly_artist_summary` AS
WITH tattoo AS (
  SELECT
    pay_week_start,
    pay_week_end,
    TEAM_MEMBER_ID,
    TEAM_MEMBER,
    COUNT(DISTINCT SALE_ID) AS tattoo_sales_count,
    ROUND(SUM(IFNULL(COMMISSION_BASE, 0)), 2) AS tattoo_commission_base,
    ROUND(SUM(IFNULL(payout_total, 0)), 2) AS tattoo_commission_owed
  FROM `victims-of-ink-data-platform.voi_reporting.v_payroll_tattoo_lines`
  GROUP BY 1,2,3,4
),
deposit AS (
  SELECT
    pay_week_start,
    pay_week_end,
    TEAM_MEMBER_ID,
    TEAM_MEMBER,
    COUNT(DISTINCT DEPOSIT_ID) AS deposit_txn_count,
    ROUND(SUM(IFNULL(COLLECTIONS, 0)), 2) AS deposits_collected,
    ROUND(SUM(IFNULL(REDEMPTIONS, 0)), 2) AS deposits_redeemed,
    ROUND(SUM(IFNULL(REFUNDS, 0)), 2) AS deposits_refunded
  FROM `victims-of-ink-data-platform.voi_reporting.v_payroll_deposit_lines`
  GROUP BY 1,2,3,4
)
SELECT
  COALESCE(t.pay_week_start, d.pay_week_start) AS pay_week_start,
  COALESCE(t.pay_week_end, d.pay_week_end) AS pay_week_end,
  COALESCE(t.TEAM_MEMBER_ID, d.TEAM_MEMBER_ID) AS team_member_id,
  COALESCE(t.TEAM_MEMBER, d.TEAM_MEMBER) AS team_member,
  IFNULL(t.tattoo_sales_count, 0) AS tattoo_sales_count,
  IFNULL(t.tattoo_commission_base, 0) AS tattoo_commission_base,
  IFNULL(t.tattoo_commission_owed, 0) AS tattoo_commission_owed,
  IFNULL(d.deposit_txn_count, 0) AS deposit_txn_count,
  IFNULL(d.deposits_collected, 0) AS deposits_collected,
  IFNULL(d.deposits_redeemed, 0) AS deposits_redeemed,
  IFNULL(d.deposits_refunded, 0) AS deposits_refunded
FROM tattoo t
FULL OUTER JOIN deposit d
  ON t.pay_week_start = d.pay_week_start
 AND COALESCE(t.TEAM_MEMBER_ID, -1) = COALESCE(d.TEAM_MEMBER_ID, -1)
 AND COALESCE(t.TEAM_MEMBER, '') = COALESCE(d.TEAM_MEMBER, '');

-- 5) Snapshot table used by the scheduled query (safe reruns by week partition)
CREATE TABLE IF NOT EXISTS `victims-of-ink-data-platform.voi_reporting.payroll_weekly_artist_snapshot` (
  run_ts TIMESTAMP,
  pay_week_start DATE,
  pay_week_end DATE,
  team_member_id INT64,
  team_member STRING,
  tattoo_sales_count INT64,
  tattoo_commission_base NUMERIC,
  tattoo_commission_owed NUMERIC,
  deposit_txn_count INT64,
  deposits_collected NUMERIC,
  deposits_redeemed NUMERIC,
  deposits_refunded NUMERIC
)
PARTITION BY pay_week_start
CLUSTER BY team_member_id, team_member;
