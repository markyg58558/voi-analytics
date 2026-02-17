with tattoo_sale_items as (
  select
    si.sale_item_id,
    si.sale_id,
    si.sale_number,
    si.sale_day_melbourne as sale_day,
    si.pay_week_start,
    si.team_member_id,
    si.team_member as fresha_team_member_name,
    si.team_member_norm,
    si.client_id,
    si.client,
    si.sale_type,
    si.category,
    si.item_name,
    si.quantity,
    si.total_sales as gross_sale_amount,
    si.currency_code
  from {{ ref('stg_voi__sale_items') }} si
  where (
      upper(ifnull(si.sale_type, '')) like '%TATTOO%'
      or upper(ifnull(si.category, '')) like '%TATTOO%'
      or upper(ifnull(si.item_name, '')) like '%TATTOO%'
    )
    and upper(ifnull(si.sale_type, '')) not like '%DEPOSIT%'
),
artists as (
  select
    artist_name,
    artist_name_normalized,
    commission_rate_pct,
    gst_registered,
    active,
    xero_ref,
    team_member_id
  from {{ ref('dim_artists') }}
),
rules as (
  select *
  from {{ ref('dim_artist_payout_rules') }}
  where active = true
),
base as (
  select
    t.*,
    coalesce(a.artist_name, t.fresha_team_member_name) as artist_name,
    coalesce(a.artist_name_normalized, t.team_member_norm) as artist_name_normalized,
    a.commission_rate_pct,
    a.gst_registered,
    a.xero_ref,
    r.split_mode,
    r.bank_pct,
    r.cash_pct,
    r.threshold_amount,
    r.high_amount_threshold,
    r.high_amount_bank_fixed,
    r.cash_rounding_unit,
    r.cash_rounding_mode,
    r.remainder_to_bank,
    round(ifnull(t.gross_sale_amount, 0) / 1.1, 2) as payout_basis_amount_ex_gst,
    round(
      round(ifnull(t.gross_sale_amount, 0) / 1.1, 2) * ifnull(a.commission_rate_pct, 0) / 100,
      2
    ) as payout_commission_ex_gst,
    case
      when ifnull(a.gst_registered, false)
        then round(
          round(
            round(ifnull(t.gross_sale_amount, 0) / 1.1, 2) * ifnull(a.commission_rate_pct, 0) / 100,
            2
          ) * 0.1,
          2
        )
      else 0
    end as payout_gst_topup,
    round(
      round(ifnull(t.gross_sale_amount, 0) / 1.1, 2) * ifnull(a.commission_rate_pct, 0) / 100
      + case
          when ifnull(a.gst_registered, false)
            then round(
              round(
                round(ifnull(t.gross_sale_amount, 0) / 1.1, 2) * ifnull(a.commission_rate_pct, 0) / 100,
                2
              ) * 0.1,
              2
            )
          else 0
        end,
      2
    ) as payout_total
  from tattoo_sale_items t
  left join artists a
    on (
      a.team_member_id is not null
      and t.team_member_id = a.team_member_id
    )
    or (
      a.team_member_id is null
      and t.team_member_norm = a.artist_name_normalized
    )
  left join rules r
    on r.artist_name_normalized = coalesce(a.artist_name_normalized, t.team_member_norm)
   and t.sale_day >= r.effective_from
   and (r.effective_to is null or t.sale_day <= r.effective_to)
),
split_calc as (
  select
    b.*,
    case
      when split_mode = 'THRESHOLD_CASH' then least(payout_total, ifnull(threshold_amount, payout_total))
      when split_mode = 'YULI_SPECIAL' and payout_total > ifnull(high_amount_threshold, 999999999) then ifnull(high_amount_bank_fixed, payout_total)
      when split_mode = 'YULI_SPECIAL' then round(payout_total * ifnull(bank_pct, 0.5), 2)
      when split_mode = 'PERCENT_SPLIT' then round(payout_total * ifnull(bank_pct, 1), 2)
      else payout_total
    end as bank_raw,
    case
      when split_mode = 'THRESHOLD_CASH' then greatest(payout_total - ifnull(threshold_amount, payout_total), 0)
      when split_mode = 'YULI_SPECIAL' and payout_total > ifnull(high_amount_threshold, 999999999) then greatest(payout_total - ifnull(high_amount_bank_fixed, payout_total), 0)
      when split_mode = 'YULI_SPECIAL' then round(payout_total * ifnull(cash_pct, 0.5), 2)
      when split_mode = 'PERCENT_SPLIT' then round(payout_total * ifnull(cash_pct, 0), 2)
      else 0
    end as cash_raw
  from base b
),
round_calc as (
  select
    s.*,
    case
      when ifnull(cash_rounding_unit, 0) <= 0 then cash_raw
      when lower(ifnull(cash_rounding_mode, 'nearest')) = 'down' then floor(cash_raw / cash_rounding_unit) * cash_rounding_unit
      when lower(ifnull(cash_rounding_mode, 'nearest')) = 'up' then ceil(cash_raw / cash_rounding_unit) * cash_rounding_unit
      else round(cash_raw / cash_rounding_unit, 0) * cash_rounding_unit
    end as cash_rounded
  from split_calc s
)
select
  sale_item_id,
  sale_id,
  sale_number,
  sale_day,
  pay_week_start,
  date_add(pay_week_start, interval 6 day) as pay_week_end,
  team_member_id,
  artist_name,
  artist_name_normalized,
  client_id,
  client,
  sale_type,
  category,
  item_name,
  quantity,
  gross_sale_amount,
  payout_basis_amount_ex_gst,
  payout_basis_amount_ex_gst as payout_basis_amount,
  payout_commission_ex_gst,
  payout_gst_topup,
  commission_rate_pct,
  gst_registered,
  xero_ref,
  split_mode,
  payout_total,
  cash_raw,
  cash_rounded as cash_payout_amount,
  case
    when ifnull(remainder_to_bank, true) then round(payout_total - cash_rounded, 2)
    else round(bank_raw, 2)
  end as bank_payout_amount,
  currency_code
from round_calc
