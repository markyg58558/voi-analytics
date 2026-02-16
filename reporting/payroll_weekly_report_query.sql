-- Weekly payroll report for a custom period (inclusive)
DECLARE start_date DATE DEFAULT DATE '2026-02-10';
DECLARE end_date DATE DEFAULT DATE '2026-02-16';

-- Summary by artist
SELECT
  team_member,
  SUM(tattoo_count) AS tattoo_count,
  ROUND(SUM(tattoo_commission_owed), 2) AS tattoo_commission_owed,
  SUM(deposit_txn_count) AS deposit_txn_count,
  ROUND(SUM(deposits_collected), 2) AS deposits_collected
FROM `victims-of-ink-data-platform.voi_reporting.v_payroll_weekly_artist_summary`
WHERE pay_week_start BETWEEN DATE_TRUNC(start_date, WEEK(SATURDAY))
                        AND DATE_TRUNC(end_date, WEEK(SATURDAY))
GROUP BY team_member
ORDER BY tattoo_commission_owed DESC;

-- Detailed tattoo lines in period
SELECT
  sale_day,
  TEAM_MEMBER,
  CLIENT,
  SALE_NUMBER,
  SALE_ITEM,
  COMMISSION
FROM `victims-of-ink-data-platform.voi_reporting.v_payroll_tattoo_lines`
WHERE sale_day BETWEEN start_date AND end_date
ORDER BY TEAM_MEMBER, sale_day, SALE_NUMBER;
