with ranked_team_members as (
  select
    team_member_id,
    full_name as team_member_name,
    full_name_norm,
    employment_start_date,
    employment_end_date,
    deleted_at,
    loaded_at,
    row_number() over (
      partition by team_member_id
      order by loaded_at desc
    ) as rn
  from {{ ref('stg_voi__team_members') }}
),
artist_config as (
  select *
  from {{ ref('stg_voi__artist_payout_config') }}
)
select
  tm.team_member_id,
  tm.team_member_name,
  ac.artist_name,
  ac.artist_name_normalized,
  ac.commission_rate,
  ac.gst_registered,
  ac.active,
  ac.abn
from ranked_team_members tm
left join artist_config ac
  on tm.team_member_id = ac.team_member_id
where tm.rn = 1
