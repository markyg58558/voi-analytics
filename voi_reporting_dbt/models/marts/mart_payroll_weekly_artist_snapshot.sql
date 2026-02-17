{{ config(
    materialized='incremental',
    unique_key=['pay_week_start', 'team_member_id'],
    incremental_strategy='merge',
    on_schema_change='sync_all_columns',
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
    cast(tattoo_commission_owed as numeric) as tattoo_commission_owed,
    cast(bank_payout_amount as numeric) as bank_payout_amount,
    cast(cash_payout_amount as numeric) as cash_payout_amount,
    deposit_txn_count,
    deposits_collected,
    deposits_redeemed,
    deposits_refunded
  from {{ ref('mart_payroll_weekly_artist') }}
)

select * from base
