{% macro voi_tz() %}
  {{ return(var('voi_timezone', 'Australia/Melbourne')) }}
{% endmacro %}

{% macro voi_lead_lost_days() %}
  {{ return(var('lead_lost_days', 7)) }}
{% endmacro %}

{% macro voi_local_datetime(ts_expr) %}
  datetime({{ ts_expr }}, "{{ voi_tz() }}")
{% endmacro %}

{% macro voi_local_date(ts_expr) %}
  date({{ ts_expr }}, "{{ voi_tz() }}")
{% endmacro %}

{% macro voi_local_current_date() %}
  current_date("{{ voi_tz() }}")
{% endmacro %}

{% macro voi_parse_local_datetime_to_utc(expr) %}
  timestamp(cast({{ expr }} as datetime), "{{ voi_tz() }}")
{% endmacro %}

{% macro voi_local_date_from_local_datetime(expr) %}
  date(cast({{ expr }} as datetime))
{% endmacro %}
