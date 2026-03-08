-- Appointment workflow + accounting-friendly order linkage (non-breaking)
-- Extends existing appointments/orders/payments model.
--
-- Why this migration:
-- - Track deposit email / reminder sends for calendar icons
-- - Track arrival/checkout milestones for workflow
-- - Enforce one appointment -> one order (invoice/receipt) for cleaner deposit linkage
-- - Prepare order line items for product + service checkout without redesigning payments

-- ---------------------------------------------------------------------
-- 1) Appointments: workflow + communication timestamps for calendar UX
-- ---------------------------------------------------------------------
alter table public.appointments
  add column if not exists deposit_email_sent_at timestamptz,
  add column if not exists deposit_link_last_generated_at timestamptz,
  add column if not exists reminder_72h_email_sent_at timestamptz,
  add column if not exists arrived_at timestamptz,
  add column if not exists checked_out_at timestamptz,
  add column if not exists paid_in_full_at timestamptz;

-- Optional helper indexes for operational queues / dashboards
create index if not exists idx_appointments_reminder_72h_sent_at
  on public.appointments (reminder_72h_email_sent_at);

create index if not exists idx_appointments_checked_out_at
  on public.appointments (checked_out_at);

-- Note: appointment_status enum already includes 'checked_in' and 'in_progress'.
-- We can use 'checked_in' as the backend status for your UI label 'arrived'.
-- No enum migration required right now.

-- ---------------------------------------------------------------------
-- 2) Orders: make appointment order linkage explicit and safer
-- ---------------------------------------------------------------------
-- Enforce one appointment order per appointment (keeps deposits tied to one invoice/order)
create unique index if not exists uniq_orders_appointment_id
  on public.orders (appointment_id)
  where appointment_id is not null;

-- Add operational invoice/receipt lifecycle timestamps and external sync placeholders
alter table public.orders
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists xero_invoice_id text,
  add column if not exists xero_sync_status text,
  add column if not exists notes text;

-- Backfill opened_at from created_at where missing
update public.orders
set opened_at = coalesce(opened_at, created_at)
where opened_at is null;

create index if not exists idx_orders_studio_status
  on public.orders (studio_id, status);

create index if not exists idx_orders_client_id
  on public.orders (client_id);

-- ---------------------------------------------------------------------
-- 3) Order items: support clearer checkout line items (services/products)
-- ---------------------------------------------------------------------
alter table public.order_items
  add column if not exists line_total_amount numeric(10,2),
  add column if not exists sort_order int not null default 0,
  add column if not exists notes text;

-- Backfill line totals where possible
update public.order_items
set line_total_amount = coalesce(line_total_amount, round((coalesce(quantity, 0) * coalesce(unit_price, 0))::numeric, 2))
where line_total_amount is null;

create index if not exists idx_order_items_order_sort
  on public.order_items (order_id, sort_order, id);

-- ---------------------------------------------------------------------
-- 4) Payments: optional Xero/export references + indexing for order settlement
-- ---------------------------------------------------------------------
alter table public.payments
  add column if not exists reference text,
  add column if not exists notes text,
  add column if not exists xero_payment_id text;

create index if not exists idx_payments_order_id
  on public.payments (order_id);

create index if not exists idx_payments_appointment_id
  on public.payments (appointment_id);

create index if not exists idx_payments_status_paid_at
  on public.payments (status, paid_at);

-- ---------------------------------------------------------------------
-- 5) Guidance for app logic (no SQL changes below)
-- ---------------------------------------------------------------------
-- New bookings should create:
--   appointments row
--   orders row (order_type='appointment', status='open', appointment_id set)
--   order_items row for the initial service line
--
-- Deposit Stripe webhook should:
--   insert payments row (already done)
--   set payments.order_id to the appointment's order
--   update orders.balance_due_amount / status (open|partially_paid|paid)
--   update appointments.deposit_paid_amount and appointments.paid_in_full_at if applicable
