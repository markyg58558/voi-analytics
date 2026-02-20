with clients_latest as (
  select
    client_id,
    client_name,
    email,
    email_norm,
    mobile_number,
    mobile_digits,
    signup_date,
    first_appointment_date,
    last_appointment_date,
    referral_source,
    sms_notifications_enabled,
    whatsapp_notifications_enabled,
    email_notifications_enabled,
    accepts_sms_marketing_notifications,
    accepts_whatsapp_marketing_notifications,
    accepts_email_marketing_notifications,
    total_appointments,
    total_appointment_value,
    loaded_at,
    row_number() over (partition by client_id order by loaded_at desc) as rn
  from {{ ref('stg_voi__clients') }}
),
clients as (
  select *
  from clients_latest
  where rn = 1
),
sales_rollup as (
  select
    client_id,
    count(distinct sale_id) as sales_count,
    min(sale_ts_utc) as first_sale_at_utc,
    max(sale_ts_utc) as last_sale_at_utc,
    min(sale_day_melbourne) as first_sale_day_melbourne,
    max(sale_day_melbourne) as last_sale_day_melbourne,
    round(sum(ifnull(total_sales, 0)), 2) as lifetime_sales_amount,
    round(sum(ifnull(total_payments, 0)), 2) as lifetime_payments_amount
  from {{ ref('stg_voi__sales') }}
  where client_id is not null
    and upper(ifnull(transaction_type, '')) = 'SALE'
    and upper(ifnull(sale_status, '')) in ('COMPLETED', 'PART PAID')
  group by 1
),
bookings_rollup as (
  select
    client_id,
    count(distinct booking_id) as bookings_count,
    min(scheduled_ts_utc) as first_booked_at_utc,
    max(scheduled_ts_utc) as last_booked_at_utc
  from {{ ref('stg_voi__bookings') }}
  where client_id is not null
    and ifnull(is_cancelled, false) = false
    and upper(ifnull(booking_status, '')) not like '%CANCEL%'
  group by 1
),
lead_first_touch as (
  select
    matched_client_id as client_id,
    lead_id as first_touch_lead_id,
    lead_created_at as first_touch_at_utc,
    lead_source as first_touch_source,
    utm_source as first_touch_utm_source,
    utm_medium as first_touch_utm_medium,
    utm_campaign as first_touch_utm_campaign,
    gclid as first_touch_gclid
  from (
    select
      matched_client_id,
      lead_id,
      lead_created_at,
      lead_source,
      utm_source,
      utm_medium,
      utm_campaign,
      gclid,
      row_number() over (
        partition by matched_client_id
        order by lead_created_at asc, lead_id asc
      ) as rn
    from {{ ref('mart_lead_lifecycle') }}
    where matched_client_id is not null
  )
  where rn = 1
),
lead_last_touch as (
  select
    matched_client_id as client_id,
    lead_id as last_touch_lead_id,
    lead_created_at as last_touch_at_utc,
    lead_source as last_touch_source,
    utm_source as last_touch_utm_source,
    utm_medium as last_touch_utm_medium,
    utm_campaign as last_touch_utm_campaign,
    gclid as last_touch_gclid
  from (
    select
      matched_client_id,
      lead_id,
      lead_created_at,
      lead_source,
      utm_source,
      utm_medium,
      utm_campaign,
      gclid,
      row_number() over (
        partition by matched_client_id
        order by lead_created_at desc, lead_id desc
      ) as rn
    from {{ ref('mart_lead_lifecycle') }}
    where matched_client_id is not null
  )
  where rn = 1
)
select
  c.client_id,
  c.client_name,
  c.email,
  c.mobile_number,
  c.signup_date,
  c.first_appointment_date,
  c.last_appointment_date,
  c.referral_source,
  c.total_appointments,
  c.total_appointment_value,
  ifnull(s.sales_count, 0) as sales_count,
  ifnull(b.bookings_count, 0) as bookings_count,
  s.first_sale_at_utc,
  {{ voi_local_datetime('s.first_sale_at_utc') }} as first_sale_at_melbourne,
  s.last_sale_at_utc,
  {{ voi_local_datetime('s.last_sale_at_utc') }} as last_sale_at_melbourne,
  s.first_sale_day_melbourne,
  s.last_sale_day_melbourne,
  ifnull(s.lifetime_sales_amount, 0) as lifetime_sales_amount,
  ifnull(s.lifetime_payments_amount, 0) as lifetime_payments_amount,
  case
    when s.last_sale_day_melbourne is null then null
    else date_diff({{ voi_local_current_date() }}, s.last_sale_day_melbourne, day)
  end as days_since_last_sale,
  c.email_notifications_enabled,
  c.sms_notifications_enabled,
  c.whatsapp_notifications_enabled,
  c.accepts_email_marketing_notifications,
  c.accepts_sms_marketing_notifications,
  c.accepts_whatsapp_marketing_notifications,
  case when ft.client_id is not null then true else false end as has_lead,
  ft.first_touch_lead_id,
  ft.first_touch_at_utc,
  {{ voi_local_datetime('ft.first_touch_at_utc') }} as first_touch_at_melbourne,
  ft.first_touch_source,
  ft.first_touch_utm_source,
  ft.first_touch_utm_medium,
  ft.first_touch_utm_campaign,
  ft.first_touch_gclid,
  lt.last_touch_lead_id,
  lt.last_touch_at_utc,
  {{ voi_local_datetime('lt.last_touch_at_utc') }} as last_touch_at_melbourne,
  lt.last_touch_source,
  lt.last_touch_utm_source,
  lt.last_touch_utm_medium,
  lt.last_touch_utm_campaign,
  lt.last_touch_gclid,
  case
    when ft.client_id is not null then 'lead_driven'
    when lower(ifnull(c.referral_source, '')) like '%walk%' then 'walk_in'
    when lower(ifnull(c.referral_source, '')) like '%referr%' then 'referral'
    else 'organic_or_unknown'
  end as acquisition_type,
  case
    when s.last_sale_day_melbourne is null then 'prospect'
    when date_diff({{ voi_local_current_date() }}, s.last_sale_day_melbourne, day) <= 90 then 'active'
    when date_diff({{ voi_local_current_date() }}, s.last_sale_day_melbourne, day) <= 180 then 'at_risk'
    else 'lapsed'
  end as lifecycle_segment
from clients c
left join sales_rollup s
  on c.client_id = s.client_id
left join bookings_rollup b
  on c.client_id = b.client_id
left join lead_first_touch ft
  on c.client_id = ft.client_id
left join lead_last_touch lt
  on c.client_id = lt.client_id
