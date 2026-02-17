with tattoo_artists_by_sale as (
  select
    si.sale_id,
    count(distinct si.team_member_id) as artist_count,
    any_value(si.team_member) as artist_name
  from {{ ref('stg_voi__sale_items') }} si
  where (
      upper(ifnull(si.sale_type, '')) like '%TATTOO%'
      or upper(ifnull(si.category, '')) like '%TATTOO%'
      or upper(ifnull(si.item_name, '')) like '%TATTOO%'
    )
    and upper(ifnull(si.sale_type, '')) not like '%DEPOSIT%'
  group by 1
),
cash_sales as (
  select
    sale_id,
    sale_number as inv_no,
    sale_day_melbourne as sale_date,
    pay_week_start,
    date_add(pay_week_start, interval 6 day) as pay_week_end,
    team_member_id as checkout_team_member_id,
    team_member as checkout_team_member_name,
    client as cust,
    total_sales as invoice_total_amount,
    total_payments as cash_collected_amount,
    currency_code
  from {{ ref('stg_voi__sales') }}
  where upper(ifnull(payment_method, '')) = 'CASH'
    and upper(ifnull(transaction_type, '')) = 'SALE'
    and upper(ifnull(sale_status, '')) in ('COMPLETED', 'PART PAID')
)
select
  c.inv_no,
  c.sale_date as date,
  case
    when ta.artist_count > 1 then 'Multiple Artists'
    when ta.artist_count = 1 then ta.artist_name
    else c.checkout_team_member_name
  end as artist,
  c.cust,
  c.cash_collected_amount as amount,
  c.invoice_total_amount,
  c.sale_id,
  c.checkout_team_member_id as team_member_id,
  c.pay_week_start,
  c.pay_week_end,
  c.currency_code
from cash_sales c
left join tattoo_artists_by_sale ta
  on c.sale_id = ta.sale_id
