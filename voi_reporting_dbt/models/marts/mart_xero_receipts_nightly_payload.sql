{{ config(materialized='view') }}

with eligible_sales as (
  select
    s.sale_id,
    s.sale_number,
    s.client as client_name,
    s.payment_status,
    s.sale_status,
    s.currency_code,
    s.sale_day_melbourne as run_day_local,
    round(ifnull(s.total_sales, 0), 2) as total_sales
  from {{ ref('stg_voi__sales') }} s
  where s.sale_day_melbourne = {{ voi_local_current_date() }}
    and lower(ifnull(s.sale_status, '')) not in ('cancelled', 'void')
    and ifnull(s.total_sales, 0) > 0
),

invoice_lines as (
  select
    si.sale_id,
    si.sale_item_id,
    ifnull(si.item_name, 'Sale Item') as line_description,
    cast(ifnull(si.quantity, 1) as int64) as quantity,
    round(ifnull(si.net_sales, 0), 2) as net_amount,
    round(ifnull(si.taxes_on_net_sales, 0), 2) as tax_amount,
    round(ifnull(si.total_sales, 0), 2) as gross_amount,
    ifnull(si.category, 'Uncategorised') as item_category,
    ifnull(si.sale_type, 'General') as sale_type
  from {{ ref('stg_voi__sale_items') }} si
  inner join eligible_sales es
    on es.sale_id = si.sale_id
  where ifnull(si.total_sales, 0) <> 0
),

payment_allocations as (
  select
    p.sale_id,
    p.payment_no,
    p.payment_day_melbourne as payment_day_local,
    p.payment_method,
    p.is_deposit_redemption,
    p.is_gift_card_redemption,
    round(ifnull(p.payment_amount, 0), 2) as payment_amount,
    case
      when ifnull(p.is_gift_card_redemption, false) then 'gift_voucher_clearing'
      when ifnull(p.is_deposit_redemption, false) then 'deposits_clearing'
      when lower(ifnull(p.payment_method, '')) like '%eftpos%' then 'fresha_eftpos_clearing'
      when lower(ifnull(p.payment_method, '')) like '%card%' then 'fresha_eftpos_clearing'
      else 'fresha_eftpos_clearing'
    end as clearing_bucket
  from {{ ref('stg_voi__payments') }} p
  inner join eligible_sales es
    on es.sale_id = p.sale_id
  where p.payment_day_melbourne = {{ voi_local_current_date() }}
    and round(ifnull(p.payment_amount, 0), 2) > 0
),

payment_totals as (
  select
    sale_id,
    round(sum(payment_amount), 2) as paid_total
  from payment_allocations
  group by 1
),

receipt_ready_sales as (
  select
    es.*,
    round(ifnull(pt.paid_total, 0), 2) as paid_total
  from eligible_sales es
  left join payment_totals pt
    on pt.sale_id = es.sale_id
  where round(ifnull(pt.paid_total, 0), 2) >= es.total_sales
)

select
  'invoice_header' as record_type,
  r.sale_id,
  r.sale_number as source_row_id,
  r.run_day_local as business_day_local,
  r.client_name as description_1,
  cast(null as string) as description_2,
  r.currency_code,
  r.total_sales as amount_1,
  r.paid_total as amount_2,
  concat('Fresha receipt ', r.sale_number) as reference
from receipt_ready_sales r

union all

select
  'invoice_line' as record_type,
  l.sale_id,
  cast(l.sale_item_id as string) as source_row_id,
  r.run_day_local as business_day_local,
  l.line_description as description_1,
  l.item_category as description_2,
  cast(null as string) as currency_code,
  l.gross_amount as amount_1,
  cast(null as numeric) as amount_2,
  l.sale_type as reference
from invoice_lines l
inner join receipt_ready_sales r
  on r.sale_id = l.sale_id

union all

select
  'invoice_payment' as record_type,
  p.sale_id,
  cast(p.payment_no as string) as source_row_id,
  p.payment_day_local as business_day_local,
  p.payment_method as description_1,
  p.clearing_bucket as description_2,
  cast(null as string) as currency_code,
  p.payment_amount as amount_1,
  cast(null as numeric) as amount_2,
  concat('Payment allocation for sale ', cast(p.sale_id as string)) as reference
from payment_allocations p
inner join receipt_ready_sales r
  on r.sale_id = p.sale_id
