select
  cast(CLIENT_ID as int64) as client_id,
  CLIENT as client_name,
  lower(trim(CLIENT)) as client_name_norm,
  EMAIL as email,
  lower(trim(EMAIL)) as email_norm,
  MOBILE_NUMBER as mobile_number,
  regexp_replace(ifnull(MOBILE_NUMBER, ''), r'[^0-9]', '') as mobile_digits,
  cast(SIGNUP_DATE as date) as signup_date,
  cast(FIRST_APPOINTMENT_DATE as date) as first_appointment_date,
  cast(LAST_APPOINTMENT_DATE as date) as last_appointment_date,
  cast(TOTAL_APPOINTMENTS as int64) as total_appointments,
  cast(TOTAL_APPOINTMENT_VALUE as numeric) as total_appointment_value,
  cast(_loaded_at as timestamp) as loaded_at
from {{ source('voi_warehouse', 'clients') }}
