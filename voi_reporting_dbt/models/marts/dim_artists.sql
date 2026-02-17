with artist_master as (
  select
    artist_name,
    artist_name_normalized,
    first_name,
    nullif(trim(cast(abn as string)), '') as abn,
    safe_cast(cast(commission_rate_pct as string) as numeric) as commission_rate_pct,
    safe_cast(cast(gst_registered as string) as bool) as gst_registered,
    safe_cast(cast(active as string) as bool) as active,
    xero_ref
  from {{ ref('artist_master_seed') }}
),
team_members_latest as (
  select
    team_member_id,
    full_name as team_member_name,
    full_name_norm
  from (
    select
      team_member_id,
      full_name,
      full_name_norm,
      loaded_at,
      row_number() over (
        partition by team_member_id
        order by loaded_at desc
      ) as rn
    from {{ ref('stg_voi__team_members') }}
  )
  where rn = 1
),
name_bridge as (
  select
    full_name_norm as fresha_name_normalized,
    full_name_norm as artist_name_normalized
  from team_members_latest

  union all

  select
    fresha_name_normalized,
    artist_name_normalized
  from {{ ref('artist_name_alias_seed') }}
),
team_members_by_artist as (
  select
    nb.artist_name_normalized,
    tm.team_member_id,
    tm.team_member_name,
    row_number() over (
      partition by nb.artist_name_normalized
      order by tm.team_member_id desc
    ) as rn
  from name_bridge nb
  join team_members_latest tm
    on nb.fresha_name_normalized = tm.full_name_norm
)
select
  am.artist_name,
  am.artist_name_normalized,
  am.first_name,
  am.abn,
  am.commission_rate_pct,
  am.gst_registered,
  am.active,
  am.xero_ref,
  tm.team_member_id,
  tm.team_member_name
from artist_master am
left join team_members_by_artist tm
  on am.artist_name_normalized = tm.artist_name_normalized
 and tm.rn = 1
