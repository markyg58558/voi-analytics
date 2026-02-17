with cash_sales as (
  select
    sale_id,
    sale_number as inv_no,
    sale_day_melbourne as sale_date,
    pay_week_start,
    date_add(pay_week_start, interval 6 day) as pay_week_end,
    team_member_id,
    team_member as artist,
    client as cust,
    total_sales as amount,
    currency_code
  from {{ ref('stg_voi__sales') }}
  where upper(ifnull(payment_method, '')) = 'CASH'
    and upper(ifnull(transaction_type, '')) = 'SALE'
    and upper(ifnull(sale_status, '')) in ('COMPLETED', 'PART PAID')
)
select
  inv_no,
  sale_date as date,
  artist,
  cust,
  amount,
  sale_id,
  team_member_id,
  pay_week_start,
  pay_week_end,
  currency_code
from cash_sales
