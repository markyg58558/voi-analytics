-- Tattoo Studio MVP schema (Supabase/Postgres)
-- Draft migration for architecture-first scaffolding.

create extension if not exists pgcrypto;

-- Enums (MVP)
do $$ begin
  create type staff_role_type as enum ('owner', 'manager', 'artist', 'front_desk', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appointment_status as enum (
    'requested',
    'pending_deposit',
    'confirmed',
    'checked_in',
    'in_progress',
    'completed',
    'cancelled',
    'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('open', 'partially_paid', 'paid', 'voided', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method_type as enum ('cash', 'card', 'stripe_link', 'manual_card', 'gift_card');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reminder_status as enum ('queued', 'sent', 'failed', 'skipped');
exception when duplicate_object then null; end $$;

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/New_York',
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone_e164 text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.artists (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  display_name text not null,
  bio text,
  phone_e164 text,
  email text,
  default_deposit_type text check (default_deposit_type in ('fixed', 'percent')),
  default_deposit_value numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_roles (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role staff_role_type not null,
  artist_id uuid references public.artists(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (studio_id, user_id, role)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone_e164 text,
  email text,
  dob date,
  marketing_opt_in boolean not null default false,
  sms_opt_in boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null,
  category text not null,
  duration_minutes int not null check (duration_minutes > 0),
  base_price numeric(10,2),
  deposit_type text check (deposit_type in ('fixed', 'percent')),
  deposit_value numeric(10,2),
  taxable boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  artist_id uuid not null references public.artists(id) on delete restrict,
  status appointment_status not null default 'requested',
  source text not null default 'online',
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null,
  deposit_required_amount numeric(10,2) not null default 0,
  deposit_paid_amount numeric(10,2) not null default 0,
  quoted_total_amount numeric(10,2),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  design_brief text,
  internal_notes text,
  cancellation_reason text,
  created_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid references public.service_catalog(id) on delete set null,
  name_snapshot text not null,
  duration_minutes int not null check (duration_minutes > 0),
  unit_price numeric(10,2),
  quantity int not null default 1 check (quantity > 0),
  artist_id uuid references public.artists(id) on delete set null
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  order_type text not null default 'appointment',
  status order_status not null default 'open',
  subtotal_amount numeric(10,2) not null default 0,
  tax_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  tip_amount numeric(10,2) not null default 0,
  total_amount numeric(10,2) not null default 0,
  balance_due_amount numeric(10,2) not null default 0,
  opened_by_user_id uuid references public.profiles(id) on delete set null,
  closed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_type text not null,
  product_id uuid,
  service_id uuid references public.service_catalog(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(10,2) not null default 0,
  taxable boolean not null default false,
  artist_id uuid references public.artists(id) on delete set null
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  payment_type text not null default 'final',
  method payment_method_type not null,
  status payment_status not null default 'pending',
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'USD',
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_checkout_session_id text,
  received_by_user_id uuid references public.profiles(id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  reminder_type text not null,
  scheduled_for timestamptz not null,
  status reminder_status not null default 'queued',
  channel text not null default 'sms',
  message_log_id uuid,
  created_at timestamptz not null default now(),
  unique (appointment_id, reminder_type)
);

create table if not exists public.message_logs (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  channel text not null,
  direction text not null default 'outbound',
  provider text not null,
  provider_message_id text,
  to_e164 text,
  body text,
  status text not null default 'queued',
  error text,
  created_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references public.studios(id) on delete set null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received',
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid references public.studios(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Basic updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- RLS helper functions
create or replace function public.current_user_has_role(p_studio_id uuid, p_roles text[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.staff_roles sr
    where sr.studio_id = p_studio_id
      and sr.user_id = auth.uid()
      and sr.is_active = true
      and sr.role::text = any (p_roles)
  );
$$;

create or replace function public.current_user_artist_id(p_studio_id uuid)
returns uuid
language sql
stable
as $$
  select sr.artist_id
  from public.staff_roles sr
  where sr.studio_id = p_studio_id
    and sr.user_id = auth.uid()
    and sr.is_active = true
    and sr.artist_id is not null
  limit 1;
$$;

-- Enable RLS
alter table public.studios enable row level security;
alter table public.profiles enable row level security;
alter table public.artists enable row level security;
alter table public.staff_roles enable row level security;
alter table public.clients enable row level security;
alter table public.service_catalog enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.appointment_reminders enable row level security;
alter table public.message_logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_log enable row level security;

-- Profiles: self read/write
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select using (id = auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update using (id = auth.uid());

-- Generic staff read access (MVP)
drop policy if exists artists_staff_access on public.artists;
create policy artists_staff_access on public.artists
for all using (public.current_user_has_role(studio_id, array['owner','manager','artist','front_desk','viewer']))
with check (public.current_user_has_role(studio_id, array['owner','manager']));

drop policy if exists clients_staff_access on public.clients;
create policy clients_staff_access on public.clients
for all using (public.current_user_has_role(studio_id, array['owner','manager','artist','front_desk','viewer']))
with check (public.current_user_has_role(studio_id, array['owner','manager','front_desk','artist']));

drop policy if exists service_catalog_staff_access on public.service_catalog;
create policy service_catalog_staff_access on public.service_catalog
for all using (public.current_user_has_role(studio_id, array['owner','manager','artist','front_desk','viewer']))
with check (public.current_user_has_role(studio_id, array['owner','manager']));

-- Appointments: artist-scoped or manager/owner/front desk
drop policy if exists appointments_select_policy on public.appointments;
create policy appointments_select_policy on public.appointments
for select using (
  public.current_user_has_role(studio_id, array['owner','manager','front_desk','viewer'])
  or (
    public.current_user_has_role(studio_id, array['artist'])
    and artist_id = public.current_user_artist_id(studio_id)
  )
);

drop policy if exists appointments_write_policy on public.appointments;
create policy appointments_write_policy on public.appointments
for all using (
  public.current_user_has_role(studio_id, array['owner','manager','front_desk'])
  or (
    public.current_user_has_role(studio_id, array['artist'])
    and artist_id = public.current_user_artist_id(studio_id)
  )
)
with check (
  public.current_user_has_role(studio_id, array['owner','manager','front_desk'])
  or (
    public.current_user_has_role(studio_id, array['artist'])
    and artist_id = public.current_user_artist_id(studio_id)
  )
);

-- Orders/payments: no viewer writes
drop policy if exists orders_policy on public.orders;
create policy orders_policy on public.orders
for all using (public.current_user_has_role(studio_id, array['owner','manager','front_desk','artist','viewer']))
with check (public.current_user_has_role(studio_id, array['owner','manager','front_desk','artist']));

drop policy if exists payments_policy on public.payments;
create policy payments_policy on public.payments
for all using (public.current_user_has_role(studio_id, array['owner','manager','front_desk','artist','viewer']))
with check (public.current_user_has_role(studio_id, array['owner','manager','front_desk','artist']));

-- Service-role access for webhook ingestion will use Supabase service key and bypass RLS.
