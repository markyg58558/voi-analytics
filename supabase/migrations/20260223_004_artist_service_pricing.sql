-- Per-artist pricing and defaults for studio service presets
create table if not exists public.artist_service_pricing (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  service_id uuid not null references public.service_catalog(id) on delete cascade,
  price_amount numeric(10,2),
  duration_minutes int check (duration_minutes > 0),
  deposit_type text check (deposit_type in ('fixed', 'percent')),
  deposit_value numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, service_id)
);

create index if not exists idx_artist_service_pricing_artist
  on public.artist_service_pricing (artist_id, active);

create index if not exists idx_artist_service_pricing_service
  on public.artist_service_pricing (service_id);

create index if not exists idx_artist_service_pricing_studio
  on public.artist_service_pricing (studio_id);

drop trigger if exists trg_artist_service_pricing_updated_at on public.artist_service_pricing;
create trigger trg_artist_service_pricing_updated_at
before update on public.artist_service_pricing
for each row execute function public.set_updated_at();

