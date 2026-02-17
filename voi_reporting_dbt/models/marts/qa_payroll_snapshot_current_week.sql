{{ config(materialized='view') }}

with params as (
  select date_trunc(current_date("Australia/Melbourne"), week(saturday)) as week_start
),
src as (
  select
    pay_week_start,
    round(sum(ifnull(tattoo_commission_owed, 0)), 2) as src_tattoo_commission_owed,
    sum(ifnull(tattoo_sales_count, 0)) as src_tattoo_sales_count
  from {{ ref('mart_payroll_weekly_artist') }}
  where pay_week_start = (select week_start from params)
  group by 1
),
snap as (
  select
    pay_week_start,
    count(*) as row_count,
    countif(team_member is null or team_member = '') as missing_team_member,
    countif(tattoo_commission_owed < 0) as negative_commission_rows,
    round(sum(ifnull(tattoo_commission_owed, 0)), 2) as snap_tattoo_commission_owed,
    sum(ifnull(tattoo_sales_count, 0)) as snap_tattoo_sales_count
  from {{ ref('mart_payroll_weekly_artist_snapshot') }}
  where pay_week_start = (select week_start from params)
  group by 1
)
select
  p.week_start as pay_week_start,
  ifnull(snap.row_count, 0) as row_count,
  ifnull(snap.missing_team_member, 0) as missing_team_member,
  ifnull(snap.negative_commission_rows, 0) as negative_commission_rows,
  ifnull(src.src_tattoo_commission_owed, 0) as src_tattoo_commission_owed,
  ifnull(snap.snap_tattoo_commission_owed, 0) as snap_tattoo_commission_owed,
  ifnull(src.src_tattoo_sales_count, 0) as src_tattoo_sales_count,
  ifnull(snap.snap_tattoo_sales_count, 0) as snap_tattoo_sales_count,
  ifnull(src.src_tattoo_commission_owed, 0) = ifnull(snap.snap_tattoo_commission_owed, 0) as ok_tattoo_commission_owed,
  ifnull(src.src_tattoo_sales_count, 0) = ifnull(snap.snap_tattoo_sales_count, 0) as ok_tattoo_sales_count
from params p
left join src on src.pay_week_start = p.week_start
left join snap on snap.pay_week_start = p.week_start
