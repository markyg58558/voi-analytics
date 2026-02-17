select
  artist_name_normalized,
  safe_cast(cast(effective_from as string) as date) as effective_from,
  safe_cast(nullif(trim(cast(effective_to as string)), '') as date) as effective_to,
  split_mode,
  safe_cast(nullif(trim(cast(bank_pct as string)), '') as numeric) as bank_pct,
  safe_cast(nullif(trim(cast(cash_pct as string)), '') as numeric) as cash_pct,
  safe_cast(nullif(trim(cast(threshold_amount as string)), '') as numeric) as threshold_amount,
  safe_cast(nullif(trim(cast(high_amount_threshold as string)), '') as numeric) as high_amount_threshold,
  safe_cast(nullif(trim(cast(high_amount_bank_fixed as string)), '') as numeric) as high_amount_bank_fixed,
  safe_cast(nullif(trim(cast(cash_rounding_unit as string)), '') as numeric) as cash_rounding_unit,
  cash_rounding_mode,
  safe_cast(cast(remainder_to_bank as string) as bool) as remainder_to_bank,
  safe_cast(cast(active as string) as bool) as active
from {{ ref('artist_payout_rules_seed') }}
