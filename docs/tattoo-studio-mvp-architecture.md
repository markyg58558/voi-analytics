# Tattoo Studio Booking/POS MVP Architecture (Next.js + Supabase)

## Goals (MVP)
- Online booking with deposits and studio-side scheduling.
- In-studio POS for services, retail, tips, and payments.
- Automated reminders (SMS) and operational notifications.
- Basic reporting for revenue, bookings, no-shows, artist utilization.
- Production-minded access control, auditability, and extensible schema.

## Tech Stack
- Frontend/App: Next.js App Router (React)
- Database/Auth/Storage: Supabase (Postgres, Auth, RLS, Storage)
- Payments: Stripe (PaymentIntents, Checkout for deposits, webhooks)
- Messaging: Twilio (SMS reminders/confirmations)
- Calendar UI: FullCalendar (resource/day views later; MVP starts with day/week)

## Architecture Overview
- `Next.js app` serves:
  - Public booking flow
  - Staff dashboard/calendar/POS/reporting UI
  - Server route handlers for booking orchestration and webhooks
- `Supabase` is source of truth for:
  - Clients, artists, appointments, invoices/orders, inventory, events
  - Auth users and studio staff roles (via `profiles` + `staff_roles`)
  - Audit/event logs and reminder queue
- `Stripe` handles:
  - Appointment deposits/prepayments
  - POS card payments (MVP can start with online/manual terminal-less card links)
  - Refunds (webhook-synced)
- `Twilio` handles:
  - Booking confirmation SMS
  - Reminder SMS (24h/2h before)
  - Staff escalation notifications (optional)

## Tenancy Assumption (MVP)
- Single tattoo studio (one business entity), multi-artist.
- Schema includes `studio_id` columns anyway for future multi-studio support.
- Start with one seeded studio row and enforce by app config/context.

## Auth & Roles (Supabase Auth + RLS)
### Auth modes
- Public customer booking does not require login (guest booking).
- Staff sign in with Supabase Auth email/password or magic link.

### Core tables
- `profiles` (1:1 with `auth.users`)
- `staff_roles` (role assignments by studio)

### Roles (MVP)
- `owner`
  - Full access, reporting, payouts, inventory, settings.
- `manager`
  - Calendar/POS/reporting/inventory access; limited settings.
- `artist`
  - Own calendar/appointments/client notes (scoped), limited reports.
- `front_desk`
  - Booking, calendar management, POS checkout, client intake.
- `viewer` (optional)
  - Read-only reporting/dashboard.

### RLS strategy
- Every business table includes `studio_id`.
- Staff access policy checks membership in `staff_roles`.
- Artist-scoped tables additionally restrict writes/reads to own `artist_id` unless manager/owner.
- Public inserts allowed only through secure server route handlers (preferred) or tightly scoped Postgres function.

## Core Domain Model (MVP)
### Scheduling / Booking
- `clients`
- `artists`
- `artist_schedules` (working hours/templates)
- `artist_time_off`
- `appointments`
- `appointment_services` (multi-service sessions)
- `appointment_status_history`
- `appointment_notes`
- `appointment_reminders`

### Services / Catalog
- `service_catalog`
  - Examples: Consultation, Small Tattoo, Half Day, Full Day, Touch-Up
- `service_addons`
  - Examples: Numbing prep, aftercare kit, priority redesign

### Payments / POS / Orders
- `orders` (can be appointment-linked or walk-in retail)
- `order_items` (services, retail products, custom line items)
- `payments`
- `payment_allocations` (optional but useful for split payments)
- `tips`
- `refunds`
- `cash_drawer_events` (if cash tracking needed in MVP)

### Inventory (lightweight MVP)
- `products`
- `inventory_locations` (back room/front desk)
- `inventory_movements`

### Communications / Audit
- `message_templates`
- `message_logs`
- `webhook_events`
- `audit_log`

## Suggested Supabase Schema (Key Fields)
### `studios`
- `id uuid pk`
- `name text`
- `timezone text` (e.g., `America/Chicago`)
- `currency text default 'USD'`
- `created_at timestamptz`

### `profiles`
- `id uuid pk references auth.users(id)`
- `full_name text`
- `phone_e164 text`
- `email text`
- `created_at timestamptz`

### `staff_roles`
- `id uuid pk`
- `studio_id uuid fk`
- `user_id uuid fk -> profiles.id`
- `role text check in (...)`
- `artist_id uuid nullable fk` (links login to artist profile when applicable)
- `is_active boolean`
- `created_at timestamptz`

### `artists`
- `id uuid pk`
- `studio_id uuid fk`
- `display_name text`
- `bio text`
- `phone_e164 text`
- `email text`
- `default_deposit_type text` (`fixed`, `percent`)
- `default_deposit_value numeric(10,2)`
- `active boolean`

### `clients`
- `id uuid pk`
- `studio_id uuid fk`
- `first_name text`
- `last_name text`
- `phone_e164 text`
- `email text`
- `dob date nullable`
- `marketing_opt_in boolean`
- `sms_opt_in boolean`
- `notes text`
- `created_at timestamptz`

### `service_catalog`
- `id uuid pk`
- `studio_id uuid fk`
- `name text`
- `category text` (`consult`, `tattoo`, `touchup`, `retail`, etc.)
- `duration_minutes int`
- `base_price numeric(10,2) nullable` (nullable for quoted/custom)
- `deposit_type text nullable`
- `deposit_value numeric(10,2) nullable`
- `taxable boolean`
- `active boolean`

### `appointments`
- `id uuid pk`
- `studio_id uuid fk`
- `client_id uuid fk`
- `artist_id uuid fk`
- `status text` (`requested`,`pending_deposit`,`confirmed`,`checked_in`,`in_progress`,`completed`,`cancelled`,`no_show`)
- `source text` (`online`,`phone`,`walk_in`,`manual`)
- `start_at timestamptz`
- `end_at timestamptz`
- `timezone text`
- `deposit_required_amount numeric(10,2) default 0`
- `deposit_paid_amount numeric(10,2) default 0`
- `quoted_total_amount numeric(10,2) nullable`
- `stripe_checkout_session_id text nullable`
- `stripe_payment_intent_id text nullable`
- `design_brief text nullable`
- `internal_notes text nullable`
- `cancellation_reason text nullable`
- `created_by_user_id uuid nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `appointment_services`
- `id uuid pk`
- `appointment_id uuid fk`
- `service_id uuid fk nullable`
- `name_snapshot text`
- `duration_minutes int`
- `unit_price numeric(10,2) nullable`
- `quantity int default 1`
- `artist_id uuid fk nullable`

### `orders`
- `id uuid pk`
- `studio_id uuid fk`
- `appointment_id uuid nullable fk`
- `client_id uuid nullable fk`
- `order_type text` (`appointment`,`walk_in`,`retail`,`deposit_adjustment`)
- `status text` (`open`,`partially_paid`,`paid`,`voided`,`refunded`)
- `subtotal_amount numeric(10,2)`
- `tax_amount numeric(10,2)`
- `discount_amount numeric(10,2)`
- `tip_amount numeric(10,2)`
- `total_amount numeric(10,2)`
- `balance_due_amount numeric(10,2)`
- `opened_by_user_id uuid`
- `closed_by_user_id uuid nullable`
- `created_at timestamptz`
- `updated_at timestamptz`

### `order_items`
- `id uuid pk`
- `order_id uuid fk`
- `line_type text` (`service`,`product`,`fee`,`discount`,`custom`)
- `product_id uuid nullable`
- `service_id uuid nullable`
- `description text`
- `quantity numeric(10,2)`
- `unit_price numeric(10,2)`
- `taxable boolean`
- `artist_id uuid nullable` (for attribution/commission)

### `payments`
- `id uuid pk`
- `studio_id uuid fk`
- `order_id uuid nullable fk`
- `appointment_id uuid nullable fk`
- `payment_type text` (`deposit`,`final`,`walk_in`)
- `method text` (`cash`,`card`,`stripe_link`,`manual_card`,`gift_card`)
- `status text` (`pending`,`succeeded`,`failed`,`cancelled`,`refunded`,`partially_refunded`)
- `amount numeric(10,2)`
- `currency text`
- `stripe_payment_intent_id text nullable`
- `stripe_charge_id text nullable`
- `stripe_checkout_session_id text nullable`
- `received_by_user_id uuid nullable`
- `paid_at timestamptz nullable`
- `created_at timestamptz`

### `appointment_reminders`
- `id uuid pk`
- `appointment_id uuid fk`
- `reminder_type text` (`confirmation`,`24h`,`2h`,`follow_up`)
- `scheduled_for timestamptz`
- `status text` (`queued`,`sent`,`failed`,`skipped`)
- `channel text` (`sms`)
- `message_log_id uuid nullable`
- `created_at timestamptz`

## Booking Flow (Production-minded MVP)
1. Client selects service category, artist (optional), date/time, and submits intake form.
2. Server validates availability against `appointments`, `artist_schedules`, `artist_time_off`, buffer rules.
3. App creates:
   - `client` (upsert by phone/email)
   - `appointment` in `pending_deposit` or `confirmed` (if no deposit required)
   - `appointment_services`
4. If deposit required:
   - Create Stripe Checkout Session for deposit.
   - Store Stripe IDs on `appointments` and insert `payments` row (`pending`).
   - Return checkout URL to public booking UI.
5. Stripe webhook (`checkout.session.completed` / `payment_intent.succeeded`):
   - Mark `payments` succeeded.
   - Update `appointments.deposit_paid_amount`.
   - Move appointment to `confirmed`.
   - Queue reminders + confirmation SMS.
6. Twilio send flow logs outcome to `message_logs`; `appointment_reminders` updated to `sent/failed`.

## Calendar / Scheduling Rules (MVP)
- Duration derived from selected service(s), editable by staff.
- Prevent overlaps per artist on confirmed/in-progress appointments.
- Optional buffer before/after sessions (future: per artist).
- Timezone-safe storage in UTC (`timestamptz`), render using studio timezone.
- FullCalendar event source from server route returning normalized appointment events.

## POS / Sales Flow (MVP)
1. Staff opens order from appointment or creates walk-in order.
2. Add service lines and retail products.
3. Deposit applied automatically as credit if appointment-linked.
4. Taxes calculated server-side based on line taxable flags.
5. Payment capture:
   - Cash/manual card (MVP)
   - Stripe payment link / PaymentIntent (phase 2 for card-present/online)
6. On successful payment:
   - `orders.status = paid`, `payments` recorded
   - `appointments.status = completed` if linked and service finished
   - Inventory decremented for product lines
   - Audit log event inserted

## Reminders / Messaging
- Trigger points:
  - On booking confirmation: immediate confirmation SMS
  - 24h reminder
  - 2h reminder
  - Optional aftercare/follow-up (24h post session)
- Queue reminders in DB (`appointment_reminders`) instead of direct synchronous sends.
- Process reminders via scheduled job (Vercel Cron/Next cron endpoint or Supabase Edge Function).
- Idempotency:
  - Unique constraint on `(appointment_id, reminder_type)`
  - Skip sending if appointment status no longer active or client opted out.

## Reporting (MVP)
### Operational dashboards
- Daily bookings, confirmed vs pending deposit
- No-shows/cancellations
- Artist utilization by scheduled hours
- Tomorrow’s schedule and pending deposits

### Revenue dashboards
- Sales by day/week/month
- Revenue by artist (services + tips)
- Deposits collected vs applied vs outstanding
- Payment mix (cash/card)
- Average ticket size and rebooking rate (phase 2)

### Reporting implementation strategy
- Start with SQL views in Supabase for dashboard queries.
- Add materialized views later for larger datasets.
- Keep event timestamps/audit logs for reconciliation and webhook debugging.

## Security / Reliability Considerations
- Webhooks:
  - Verify Stripe/Twilio signatures
  - Store raw payload + processing status in `webhook_events`
  - Idempotent handlers using provider event IDs
- PII:
  - Minimize storing sensitive info (no full card data ever)
  - Staff access via RLS + least privilege
- Auditing:
  - Log status changes, payment/refund actions, manual overrides
- Backups:
  - Rely on Supabase backups; document restore process later

## Implementation Phases (Recommended)
1. Foundation: schema, auth/RLS, env/config, server clients.
2. Booking MVP: public intake, availability, appointment create, Stripe deposit.
3. Staff calendar: FullCalendar views, appointment management.
4. POS MVP: orders, order items, payment capture/manual settlement.
5. Reminders: Twilio templates + scheduler + retry handling.
6. Reporting: SQL views + dashboard cards/charts.

## Immediate Scaffolding Scope (this repo)
- Folder structure for domain modules
- Env template and service wrappers
- Route handlers (stubbed)
- Initial pages for Bookings/Calendar/POS/Reports
- Supabase SQL migration draft with tables + enums + starter RLS helpers
