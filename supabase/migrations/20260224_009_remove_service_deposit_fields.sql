-- Deposit amounts are now appointment-level only.
-- This removes service/preset deposit configuration fields after app/UI logic has been updated.

alter table public.artist_service_pricing
  drop column if exists deposit_type,
  drop column if exists deposit_value;

alter table public.service_catalog
  drop column if exists deposit_type,
  drop column if exists deposit_value;

