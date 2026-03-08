-- Client table growth fields + indexes for admin list/search and future CRM workflows
alter table public.clients
  add column if not exists preferred_name text,
  add column if not exists instagram_handle text,
  add column if not exists status text default 'active',
  add column if not exists source text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Keep status values constrained but allow future extension by altering check later.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clients_status_check'
  ) then
    alter table public.clients
      add constraint clients_status_check
      check (status in ('active', 'vip', 'do_not_book', 'archived'));
  end if;
end $$;

-- Helpful indexes
create index if not exists idx_clients_studio_created_at on public.clients (studio_id, created_at desc);
create index if not exists idx_clients_studio_last_name_first_name on public.clients (studio_id, last_name, first_name);
create index if not exists idx_clients_studio_email on public.clients (studio_id, email);
create index if not exists idx_clients_studio_phone_e164 on public.clients (studio_id, phone_e164);

-- Optional uniqueness (partial) to reduce accidental duplicates while allowing blanks
create unique index if not exists uniq_clients_studio_email_nonnull
  on public.clients (studio_id, lower(email))
  where email is not null and email <> '';

create unique index if not exists uniq_clients_studio_phone_nonnull
  on public.clients (studio_id, phone_e164)
  where phone_e164 is not null and phone_e164 <> '';

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

