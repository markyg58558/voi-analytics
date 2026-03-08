create table if not exists public.artist_weekly_availability (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_local_time time,
  end_local_time time,
  timezone text not null default 'Australia/Melbourne',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_id, day_of_week),
  check (
    (active = false)
    or (start_local_time is not null and end_local_time is not null and end_local_time > start_local_time)
  )
);

create index if not exists idx_artist_weekly_availability_artist
  on public.artist_weekly_availability (artist_id, day_of_week);

create index if not exists idx_artist_weekly_availability_studio
  on public.artist_weekly_availability (studio_id, day_of_week);

drop trigger if exists trg_artist_weekly_availability_updated_at on public.artist_weekly_availability;
create trigger trg_artist_weekly_availability_updated_at
before update on public.artist_weekly_availability
for each row execute function public.set_updated_at();

