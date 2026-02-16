{{ config(
    materialized='incremental',
    unique_key=['pay_week_start', 'team_member_id'],
    incremental_strategy='merge',
    partition_by={"field": "pay_week_start", "data_type": "date"},
    cluster_by=['team_member_id']
) }}

with base as (
  select
    current_timestamp() as run_ts,
    pay_week_start,
    pay_week_end,
    team_member_id,
    team_member_name as team_member,
    tattoo_sales_count,
    tattoo_commission_base,
    cast(tattoo_commission_owed_fresha as numeric) as tattoo_commission_owed,
    deposit_txn_count,
    deposits_collected,
    deposits_redeemed,
    deposits_refunded
  from {{ ref('mart_payroll_weekly_artist') }}
  {% if is_incremental() %}
    where pay_week_start >= date_sub(date_trunc(current_date("Australia/Melbourne"), week(saturday)), interval 8 week)
  {% endif %}
)

select * from base
