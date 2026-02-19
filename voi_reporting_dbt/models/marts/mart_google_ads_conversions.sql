with completed_leads as (
  select
    lead_id,
    email,
    mobile_number,
    gclid,
    completed_at,
    payment_amount,
    sale_amount,
    currency_code,
    matched_sale_id
  from {{ ref('mart_lead_lifecycle') }}
  where is_completed = true
    and matched_sale_id is not null
),
normalized as (
  select
    lead_id,
    gclid,
    completed_at,
    cast(coalesce(payment_amount, sale_amount, 0) as float64) as conversion_value,
    coalesce(currency_code, 'AUD') as currency_code,
    concat('sale_', cast(matched_sale_id as string)) as order_id,
    lower(trim(email)) as email_norm,
    regexp_replace(ifnull(mobile_number, ''), r'[^0-9+]', '') as mobile_norm
  from completed_leads
)
select
  format_timestamp('%Y-%m-%d %H:%M:%S%Ez', completed_at, 'Australia/Melbourne') as conversion_event_time,
  gclid,
  case
    when email_norm is null or email_norm = '' then null
    else lower(to_hex(sha256(email_norm)))
  end as hashed_email,
  case
    when mobile_norm is null or mobile_norm = '' then null
    else lower(
      to_hex(
        sha256(
          regexp_replace(
            case
              when regexp_contains(mobile_norm, r'^0') then concat('+61', substr(mobile_norm, 2))
              when regexp_contains(mobile_norm, r'^61') then concat('+', mobile_norm)
              when regexp_contains(mobile_norm, r'^\+61') then mobile_norm
              else mobile_norm
            end,
            r'[^0-9+]',
            ''
          )
        )
      )
    )
  end as hashed_phone_number,
  conversion_value,
  currency_code,
  order_id
from normalized
where gclid is not null and gclid != ''
  and completed_at is not null
