-- Add artist contact/profile fields used by Admin > Artists
alter table public.artists
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists phone_e164 text;

create index if not exists idx_artists_email on public.artists (email);
create index if not exists idx_artists_phone_e164 on public.artists (phone_e164);

