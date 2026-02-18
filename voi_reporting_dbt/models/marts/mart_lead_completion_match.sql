with clients_latest as (
  select
    client_id,
    client_name,
    email,
    email_norm,
    mobile_number,
    mobile_digits,
    loaded_at,
    row_number() over (partition by client_id order by loaded_at desc) as rn
  from {{ ref('stg_voi__clients') }}
),
clients as (
  select *
  from clients_latest
  where rn = 1
),
leads as (
  select *
  from {{ ref('stg_ops__leads') }}
),
lead_client_email as (
  select
    l.lead_id,
    c.client_id,
    'email' as client_match_method,
    row_number() over (partition by l.lead_id order by c.loaded_at desc, c.client_id desc) as rn
  from leads l
  join clients c
    on l.email_norm != ''
   and l.email_norm = c.email_norm
),
lead_client_mobile as (
  select
    l.lead_id,
    c.client_id,
    'mobile' as client_match_method,
    row_number() over (partition by l.lead_id order by c.loaded_at desc, c.client_id desc) as rn
  from leads l
  join clients c
    on l.mobile_digits != ''
   and l.mobile_digits = c.mobile_digits
),
lead_client_best as (
  select
    lead_id,
    client_id,
    client_match_method,
    row_number() over (partition by lead_id order by match_priority asc) as rn
  from (
    select lead_id, client_id, client_match_method, 1 as match_priority
    from lead_client_email
    where rn = 1
    union all
    select lead_id, client_id, client_match_method, 2 as match_priority
    from lead_client_mobile
    where rn = 1
  )
),
leads_with_client as (
  select
    l.*,
    b.client_id as matched_client_id,
    b.client_match_method,
    c.client_name as matched_client_name,
    c.email as matched_client_email,
    c.mobile_number as matched_client_mobile
  from leads l
  left join lead_client_best b
    on l.lead_id = b.lead_id
   and b.rn = 1
  left join clients c
    on b.client_id = c.client_id
),
sales_filtered as (
  select
    sale_id,
    sale_number,
    client_id,
    team_member_id,
    team_member,
    sale_status,
    payment_status,
    total_sales,
    total_payments,
    currency_code,
    sale_ts_utc,
    sale_day_melbourne
  from {{ ref('stg_voi__sales') }}
  where upper(ifnull(transaction_type, '')) = 'SALE'
    and upper(ifnull(sale_status, '')) in ('COMPLETED', 'PART PAID')
    and client_id is not null
),
sale_candidates as (
  select
    l.lead_id,
    l.created_at as lead_created_at,
    l.matched_client_id,
    s.sale_id,
    s.sale_number,
    s.sale_ts_utc,
    s.sale_day_melbourne,
    s.team_member_id,
    s.team_member,
    s.sale_status,
    s.payment_status,
    s.total_sales,
    s.total_payments,
    s.currency_code,
    timestamp_diff(s.sale_ts_utc, l.created_at, hour) as hours_to_sale,
    date_diff(s.sale_day_melbourne, date(l.created_at, "Australia/Melbourne"), day) as days_to_sale,
    row_number() over (
      partition by l.lead_id
      order by timestamp_diff(s.sale_ts_utc, l.created_at, hour) asc, s.sale_ts_utc asc, s.sale_id asc
    ) as lead_rank,
    row_number() over (
      partition by s.sale_id
      order by timestamp_diff(s.sale_ts_utc, l.created_at, hour) asc, l.created_at desc, l.lead_id asc
    ) as sale_rank
  from leads_with_client l
  join sales_filtered s
    on l.matched_client_id = s.client_id
   and s.sale_ts_utc >= l.created_at
   and s.sale_ts_utc < timestamp_add(l.created_at, interval 180 day)
),
chosen_sale as (
  select *
  from sale_candidates
  where lead_rank = 1
    and sale_rank = 1
)
select
  l.lead_id,
  l.created_at as lead_created_at,
  l.updated_at as lead_updated_at,
  l.first_name,
  l.last_name,
  l.full_name,
  l.email,
  l.mobile_number,
  l.lead_source,
  l.how_heard,
  l.preferred_artist,
  l.form_name,
  l.lead_status,
  l.assigned_to,
  l.gclid,
  l.fbclid,
  l.msclkid,
  l.utm_source,
  l.utm_medium,
  l.utm_campaign,
  l.utm_term,
  l.utm_content,
  l.landing_page_url,
  l.referrer_url,
  l.matched_client_id,
  l.client_match_method,
  l.matched_client_name,
  l.matched_client_email,
  l.matched_client_mobile,
  c.sale_id as matched_sale_id,
  c.sale_number as matched_sale_number,
  c.sale_ts_utc as matched_sale_ts_utc,
  c.sale_day_melbourne as matched_sale_day,
  c.team_member_id as matched_sale_team_member_id,
  c.team_member as matched_sale_team_member_name,
  c.sale_status as matched_sale_status,
  c.payment_status as matched_payment_status,
  c.total_sales as matched_sale_total_sales,
  c.total_payments as matched_sale_total_payments,
  c.currency_code,
  c.days_to_sale,
  c.hours_to_sale,
  case
    when c.sale_id is null then null
    when c.days_to_sale = 0 then 'same_day'
    when c.days_to_sale <= 7 then 'within_7_days'
    when c.days_to_sale <= 30 then 'within_30_days'
    else 'after_30_days'
  end as conversion_window,
  case when c.sale_id is null then false else true end as is_completed,
  case
    when c.sale_id is not null then 'completed'
    when l.matched_client_id is null then 'no_client_match'
    else 'no_sale_match'
  end as completion_status
from leads_with_client l
left join chosen_sale c
  on l.lead_id = c.lead_id
