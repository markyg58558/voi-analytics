with clients_latest as (
  select
    client_id,
    client_name,
    client_name_norm,
    email,
    email_norm,
    mobile_number,
    mobile_digits,
    signup_date,
    first_appointment_date,
    last_appointment_date,
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
leads as (
  select *
  from {{ ref('stg_ops__leads') }}
),
email_matches as (
  select
    l.lead_id,
    c.client_id,
    'email' as match_method,
    1 as match_priority,
    row_number() over (partition by l.lead_id order by c.loaded_at desc, c.client_id desc) as rn
  from leads l
  join clients c
    on l.email_norm != ''
   and l.email_norm = c.email_norm
),
mobile_matches as (
  select
    l.lead_id,
    c.client_id,
    'mobile' as match_method,
    2 as match_priority,
    row_number() over (partition by l.lead_id order by c.loaded_at desc, c.client_id desc) as rn
  from leads l
  join clients c
    on l.mobile_digits != ''
   and l.mobile_digits = c.mobile_digits
),
best_matches as (
  select
    lead_id,
    client_id,
    match_method,
    match_priority,
    row_number() over (partition by lead_id order by match_priority asc) as rn
  from (
    select lead_id, client_id, match_method, match_priority
    from email_matches
    where rn = 1
    union all
    select lead_id, client_id, match_method, match_priority
    from mobile_matches
    where rn = 1
  )
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
  l.lead_status,
  l.assigned_to,
  l.inquiry_message,
  l.form_name,
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
  case when bm.client_id is null then false else true end as is_matched_to_client,
  bm.match_method,
  bm.client_id as matched_client_id,
  c.client_name as matched_client_name,
  c.email as matched_client_email,
  c.mobile_number as matched_client_mobile,
  c.signup_date as matched_client_signup_date,
  c.first_appointment_date as matched_client_first_appointment_date,
  c.last_appointment_date as matched_client_last_appointment_date,
  c.total_appointments as matched_client_total_appointments,
  c.total_appointment_value as matched_client_total_appointment_value
from leads l
left join best_matches bm
  on l.lead_id = bm.lead_id
 and bm.rn = 1
left join clients c
  on bm.client_id = c.client_id
