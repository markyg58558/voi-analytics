with tattoo as (
  select
    sale_day_melbourne as activity_date,
    team_member_id,
    team_member as team_member_name,
    count(distinct sale_id) as tattoo_sales_count,
    round(sum(ifnull(commission_base, 0)), 2) as tattoo_commission_base,
    round(sum(ifnull(commission, 0)), 2) as tattoo_commission_owed_fresha
  from {{ ref('stg_voi__commissions') }}
  group by 1, 2, 3
),
deposit as (
  select
    collection_day_melbourne as activity_date,
    team_member_id,
    team_member as team_member_name,
    count(distinct deposit_id) as deposit_txn_count,
    round(sum(ifnull(collections, 0)), 2) as deposits_collected,
    round(sum(ifnull(redemptions, 0)), 2) as deposits_redeemed,
    round(sum(ifnull(refunds, 0)), 2) as deposits_refunded
  from {{ ref('stg_voi__deposits') }}
  group by 1, 2, 3
)
select
  coalesce(t.activity_date, d.activity_date) as activity_date,
  coalesce(t.team_member_id, d.team_member_id) as team_member_id,
  coalesce(t.team_member_name, d.team_member_name) as team_member_name,
  ifnull(t.tattoo_sales_count, 0) as tattoo_sales_count,
  ifnull(t.tattoo_commission_base, 0) as tattoo_commission_base,
  ifnull(t.tattoo_commission_owed_fresha, 0) as tattoo_commission_owed_fresha,
  ifnull(d.deposit_txn_count, 0) as deposit_txn_count,
  ifnull(d.deposits_collected, 0) as deposits_collected,
  ifnull(d.deposits_redeemed, 0) as deposits_redeemed,
  ifnull(d.deposits_refunded, 0) as deposits_refunded
from tattoo t
full outer join deposit d
  on t.activity_date = d.activity_date
 and coalesce(t.team_member_id, -1) = coalesce(d.team_member_id, -1)
 and coalesce(t.team_member_name, '') = coalesce(d.team_member_name, '')
