select
  artist_name_normalized,
  cast(effective_from as date) as effective_from,
  cast(nullif(trim(effective_to), '') as date) as effective_to,
  split_mode,
  cast(nullif(trim(bank_pct), '') as numeric) as bank_pct,
  cast(nullif(trim(cash_pct), '') as numeric) as cash_pct,
  cast(nullif(trim(threshold_amount), '') as numeric) as threshold_amount,
  cast(nullif(trim(high_amount_threshold), '') as numeric) as high_amount_threshold,
  cast(nullif(trim(high_amount_bank_fixed), '') as numeric) as high_amount_bank_fixed,
  cast(nullif(trim(cash_rounding_unit), '') as numeric) as cash_rounding_unit,
  cash_rounding_mode,
  cast(remainder_to_bank as bool) as remainder_to_bank,
  cast(active as bool) as active
from {{ ref('artist_payout_rules_seed') }}
