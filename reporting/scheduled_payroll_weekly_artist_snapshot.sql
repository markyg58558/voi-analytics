-- Scheduled query: refresh the current Melbourne payroll week snapshot (safe rerun)
-- Recommended schedule: weekly after source syncs complete.
-- BigQuery query location: australia-southeast2

DECLARE week_start DATE DEFAULT DATE_TRUNC(CURRENT_DATE("Australia/Melbourne"), WEEK(SATURDAY));

DELETE FROM `victims-of-ink-data-platform.voi_reporting.payroll_weekly_artist_snapshot`
WHERE pay_week_start = week_start;

INSERT INTO `victims-of-ink-data-platform.voi_reporting.payroll_weekly_artist_snapshot` (
  run_ts,
  pay_week_start,
  pay_week_end,
  team_member_id,
  team_member,
  tattoo_sales_count,
  tattoo_commission_base,
  tattoo_commission_owed,
  deposit_txn_count,
  deposits_collected,
  deposits_redeemed,
  deposits_refunded
)
SELECT
  CURRENT_TIMESTAMP() AS run_ts,
  pay_week_start,
  pay_week_end,
  team_member_id,
  team_member,
  tattoo_sales_count,
  tattoo_commission_base,
  CAST(tattoo_commission_owed AS NUMERIC) AS tattoo_commission_owed,
  deposit_txn_count,
  deposits_collected,
  deposits_redeemed,
  deposits_refunded
FROM `victims-of-ink-data-platform.voi_reporting.v_payroll_weekly_artist_summary`
WHERE pay_week_start = week_start;
