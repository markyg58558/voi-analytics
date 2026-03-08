-- Artist availability blocks / time-off overlays for custom scheduler board

create table if not exists public.artist_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  block_type text not null check (block_type in ('time_off', 'rostered_unavailable', 'break', 'busy_hold')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'Australia/Melbourne',
  label text,
  note text,
  color_hex text,
  affects_booking boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index if not exists idx_artist_availability_blocks_artist_time
  on public.artist_availability_blocks (artist_id, start_at, end_at);

create index if not exists idx_artist_availability_blocks_studio_time
  on public.artist_availability_blocks (studio_id, start_at, end_at);

drop trigger if exists trg_artist_availability_blocks_updated_at on public.artist_availability_blocks;
create trigger trg_artist_availability_blocks_updated_at
before update on public.artist_availability_blocks
for each row execute function public.set_updated_at();
