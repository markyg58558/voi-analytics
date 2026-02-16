{% set relation = adapter.get_relation(
    database='victims-of-ink-data-platform',
    schema='voi_reporting',
    identifier='artist_payout_config'
) %}

{% if relation is not none %}
select
  cast(team_member_id as int64) as team_member_id,
  artist_name,
  artist_name_normalized,
  cast(commission_rate as numeric) as commission_rate,
  cast(gst_registered as bool) as gst_registered,
  cast(active as bool) as active,
  abn,
  cast(updated_at as timestamp) as updated_at
from `victims-of-ink-data-platform.voi_reporting.artist_payout_config`
{% else %}
select
  cast(null as int64) as team_member_id,
  cast(null as string) as artist_name,
  cast(null as string) as artist_name_normalized,
  cast(null as numeric) as commission_rate,
  cast(null as bool) as gst_registered,
  cast(null as bool) as active,
  cast(null as string) as abn,
  cast(null as timestamp) as updated_at
where 1 = 0
{% endif %}
