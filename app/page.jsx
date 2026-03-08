import Link from 'next/link';
import StudioShell from '@/components/layout/StudioShell';

const nextSteps = [
  {
    title: '1. Apply Supabase schema + RLS',
    detail: 'Run the migration in Supabase and seed one studio, artists, and service catalog rows.'
  },
  {
    title: '2. Implement booking availability',
    detail: 'Add slot generation and overlap validation against appointments + artist schedule/time-off tables.'
  },
  {
    title: '3. Wire Stripe deposits',
    detail: 'Use /api/checkout + Stripe webhook to confirm appointments after successful deposit payment.'
  },
  {
    title: '4. Build staff calendar + POS',
    detail: 'Render FullCalendar and persist orders/payments using server routes and RLS-aware clients.'
  }
];

export default function HomePage() {
  return (
    <StudioShell
      title="Tattoo Studio Booking/POS MVP"
      subtitle="Architecture-first scaffold for bookings, calendar, deposits, reminders, POS, and reporting."
    >
      <section style={{ display: 'grid', gap: '1rem' }}>
        <article style={{ border: '1px solid #2e2e2e', borderRadius: 12, padding: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Architecture Deliverables Added</h2>
          <ul>
            <li>
              <code>docs/tattoo-studio-mvp-architecture.md</code> (production-minded plan)
            </li>
            <li>
              <code>supabase/migrations/20260222_001_tattoo_mvp_schema.sql</code> (schema + starter RLS)
            </li>
            <li>Scaffolded API routes and service wrappers for Supabase, Stripe, and Twilio</li>
          </ul>
          <p>
            Jump into the feature shells:{' '}
            <Link href="/bookings">Bookings</Link> {' • '} <Link href="/calendar">Calendar</Link> {' • '}
            <Link href="/pos">POS</Link> {' • '} <Link href="/reports">Reports</Link>
          </p>
        </article>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {nextSteps.map((step) => (
            <article key={step.title} style={{ border: '1px solid #2e2e2e', borderRadius: 12, padding: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>{step.title}</h3>
              <p style={{ marginBottom: 0, opacity: 0.85 }}>{step.detail}</p>
            </article>
          ))}
        </section>
      </section>
    </StudioShell>
  );
}
