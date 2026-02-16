select
  cast(TEAM_MEMBER_ID as int64) as team_member_id,
  FIRST_NAME as first_name,
  LAST_NAME as last_name,
  FULL_NAME as full_name,
  lower(trim(FULL_NAME)) as full_name_norm,
  EMAIL as email,
  ROLE as role,
  STAFF_TITLE as staff_title,
  EXTERNAL_ID as external_id,
  cast(EMPLOYMENT_START_DATE as date) as employment_start_date,
  cast(EMPLOYMENT_END_DATE as date) as employment_end_date,
  cast(DELETED_AT as timestamp) as deleted_at,
  cast(_loaded_at as timestamp) as loaded_at
from {{ source('voi_warehouse', 'team_members') }}
where FULL_NAME is not null
  and trim(FULL_NAME) != ''
