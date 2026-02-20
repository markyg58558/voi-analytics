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
booking_candidates as (
  select
    l.lead_id,
    b.booking_id,
    b.appointment_id,
    b.scheduled_ts_utc,
    b.service,
    b.team_member as booked_artist,
    b.booking_status,
    timestamp_diff(b.scheduled_ts_utc, l.created_at, hour) as hours_to_book,
    date_diff(
      {{ voi_local_date('b.scheduled_ts_utc') }},
      {{ voi_local_date('l.created_at') }},
      day
    ) as days_to_book,
    row_number() over (
      partition by l.lead_id
      order by timestamp_diff(b.scheduled_ts_utc, l.created_at, hour) asc, b.scheduled_ts_utc asc, b.booking_id asc
    ) as lead_rank,
    row_number() over (
      partition by b.booking_id
      order by timestamp_diff(b.scheduled_ts_utc, l.created_at, hour) asc, l.created_at desc, l.lead_id asc
    ) as booking_rank
  from leads_with_client l
  join {{ ref('stg_voi__bookings') }} b
    on l.matched_client_id = b.client_id
   and b.scheduled_ts_utc >= l.created_at
   and b.scheduled_ts_utc < timestamp_add(l.created_at, interval 180 day)
   and ifnull(b.is_cancelled, false) = false
   and upper(ifnull(b.booking_status, '')) not like '%CANCEL%'
),
chosen_booking as (
  select *
  from booking_candidates
  where lead_rank = 1
    and booking_rank = 1
),
sale_artists_by_sale as (
  select
    si.sale_id,
    count(distinct si.team_member_id) as artist_count,
    any_value(si.team_member_id) as completed_artist_team_member_id,
    any_value(si.team_member) as completed_artist_name
  from {{ ref('stg_voi__sale_items') }} si
  where (
      upper(ifnull(si.sale_type, '')) like '%TATTOO%'
      or upper(ifnull(si.category, '')) like '%TATTOO%'
      or upper(ifnull(si.item_name, '')) like '%TATTOO%'
    )
    and upper(ifnull(si.sale_type, '')) not like '%DEPOSIT%'
  group by 1
),
sale_candidates_from_booking as (
  select
    l.lead_id,
    s.sale_id,
    s.sale_number,
    s.sale_ts_utc,
    s.sale_day_melbourne,
    case
      when sa.artist_count > 1 then null
      else sa.completed_artist_team_member_id
    end as team_member_id,
    case
      when sa.artist_count > 1 then 'Multiple Artists'
      when sa.artist_count = 1 then sa.completed_artist_name
      else s.team_member
    end as completed_artist,
    s.sale_status,
    s.payment_status,
    s.total_sales,
    s.total_payments,
    s.currency_code,
    timestamp_diff(s.sale_ts_utc, l.created_at, hour) as hours_to_complete,
    date_diff(s.sale_day_melbourne, {{ voi_local_date('l.created_at') }}, day) as days_to_complete,
    1 as match_priority
  from leads_with_client l
  join chosen_booking b
    on l.lead_id = b.lead_id
  join {{ ref('stg_voi__sales') }} s
    on s.appointment_id = b.appointment_id
   and s.sale_ts_utc >= l.created_at
   and s.sale_ts_utc < timestamp_add(l.created_at, interval 180 day)
   and upper(ifnull(s.transaction_type, '')) = 'SALE'
   and upper(ifnull(s.sale_status, '')) in ('COMPLETED', 'PART PAID')
  left join sale_artists_by_sale sa
    on s.sale_id = sa.sale_id
),
sale_candidates_from_client as (
  select
    l.lead_id,
    s.sale_id,
    s.sale_number,
    s.sale_ts_utc,
    s.sale_day_melbourne,
    case
      when sa.artist_count > 1 then null
      else sa.completed_artist_team_member_id
    end as team_member_id,
    case
      when sa.artist_count > 1 then 'Multiple Artists'
      when sa.artist_count = 1 then sa.completed_artist_name
      else s.team_member
    end as completed_artist,
    s.sale_status,
    s.payment_status,
    s.total_sales,
    s.total_payments,
    s.currency_code,
    timestamp_diff(s.sale_ts_utc, l.created_at, hour) as hours_to_complete,
    date_diff(s.sale_day_melbourne, {{ voi_local_date('l.created_at') }}, day) as days_to_complete,
    2 as match_priority
  from leads_with_client l
  join {{ ref('stg_voi__sales') }} s
    on l.matched_client_id = s.client_id
   and s.sale_ts_utc >= l.created_at
   and s.sale_ts_utc < timestamp_add(l.created_at, interval 180 day)
   and upper(ifnull(s.transaction_type, '')) = 'SALE'
   and upper(ifnull(s.sale_status, '')) in ('COMPLETED', 'PART PAID')
  left join sale_artists_by_sale sa
    on s.sale_id = sa.sale_id
),
sale_candidates as (
  select * from sale_candidates_from_booking
  union all
  select * from sale_candidates_from_client
),
sale_ranked as (
  select
    *,
    row_number() over (
      partition by lead_id
      order by match_priority asc, hours_to_complete asc, sale_ts_utc asc, sale_id asc
    ) as lead_rank,
    row_number() over (
      partition by sale_id
      order by match_priority asc, hours_to_complete asc, lead_id asc
    ) as sale_rank
  from sale_candidates
),
chosen_sale as (
  select *
  from sale_ranked
  where lead_rank = 1
    and sale_rank = 1
)
select
  l.lead_id,
  l.created_at as lead_created_at,
  {{ voi_local_datetime('l.created_at') }} as lead_created_at_melbourne,
  l.updated_at as lead_updated_at,
  {{ voi_local_datetime('l.updated_at') }} as lead_updated_at_melbourne,
  l.lead_status as lead_status_raw,
  l.first_name,
  l.last_name,
  l.full_name,
  l.email,
  l.mobile_number,
  l.lead_source,
  l.how_heard,
  l.preferred_artist,
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
  l.matched_client_id,
  case when l.matched_client_id is not null then true else false end as is_client_matched,
  l.client_match_method,
  l.matched_client_name,
  l.matched_client_email,
  l.matched_client_mobile,
  b.booking_id as matched_booking_id,
  b.appointment_id as matched_appointment_id,
  b.scheduled_ts_utc as booked_at,
  {{ voi_local_datetime('b.scheduled_ts_utc') }} as booked_at_melbourne,
  b.service as booked_service,
  b.booked_artist,
  b.booking_status,
  b.days_to_book,
  case when b.booking_id is not null then true else false end as is_booked,
  s.sale_id as matched_sale_id,
  s.sale_number,
  s.sale_ts_utc as completed_at,
  {{ voi_local_datetime('s.sale_ts_utc') }} as completed_at_melbourne,
  s.completed_artist,
  s.team_member_id as matched_sale_team_member_id,
  s.sale_status as matched_sale_status,
  s.payment_status as matched_payment_status,
  s.total_sales as sale_amount,
  s.total_payments as payment_amount,
  s.currency_code,
  s.days_to_complete,
  s.hours_to_complete,
  case
    when s.sale_id is null then null
    when s.days_to_complete = 0 then 'same_day'
    when s.days_to_complete <= 7 then 'within_7_days'
    when s.days_to_complete <= 30 then 'within_30_days'
    else 'after_30_days'
  end as conversion_window,
  case when s.sale_id is not null then true else false end as is_completed,
  case
    when s.sale_id is not null then 'completed'
    when b.booking_id is not null then 'booked'
    when date_diff({{ voi_local_current_date() }}, {{ voi_local_date('l.created_at') }}, day) > {{ voi_lead_lost_days() }} then 'lost'
    else 'new_inquiry'
  end as lifecycle_status
from leads_with_client l
left join chosen_booking b
  on l.lead_id = b.lead_id
left join chosen_sale s
  on l.lead_id = s.lead_id
