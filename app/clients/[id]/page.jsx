import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DateTime } from 'luxon';
import StudioShell from '@/components/layout/StudioShell';
import SendDepositEmailButton from '@/components/clients/SendDepositEmailButton';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

export const metadata = {
  title: 'Client Profile | Tattoo Studio MVP'
};

function getRelationObject(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function formatMoney(amount, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(Number(amount || 0));
}

function formatInTimezone(isoString, timezone) {
  if (!isoString) return '—';
  try {
    return DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone).toFormat("ccc d LLL yyyy, h:mma");
  } catch {
    return isoString;
  }
}

async function loadClientProfile({ clientId, studioId }) {
  const supabase = getSupabaseAdminClient();

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select(
      'id,studio_id,first_name,last_name,phone_e164,email,instagram_handle,status,client_type,source,marketing_opt_in,sms_opt_in,notes,created_at,updated_at,last_contacted_at'
    )
    .eq('id', clientId)
    .eq('studio_id', studioId)
    .maybeSingle();

  if (clientError) throw new Error(clientError.message);
  if (!client) return null;

  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select(
      `
      id,studio_id,client_id,artist_id,status,source,start_at,end_at,timezone,deposit_required_amount,deposit_paid_amount,quoted_total_amount,design_brief,internal_notes,created_at,
      artists:artist_id ( display_name ),
      appointment_services ( name_snapshot )
    `
    )
    .eq('client_id', clientId)
    .order('start_at', { ascending: false })
    .limit(100);

  if (apptError) throw new Error(apptError.message);
  const appointmentRows = appointments || [];
  const appointmentIds = appointmentRows.map((a) => a.id);

  let paymentRows = [];
  if (appointmentIds.length) {
    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('id,appointment_id,payment_type,method,status,amount,currency,stripe_checkout_session_id,paid_at,created_at')
      .in('appointment_id', appointmentIds)
      .order('created_at', { ascending: false });
    if (paymentError) throw new Error(paymentError.message);
    paymentRows = payments || [];
  }

  return { client, appointments: appointmentRows, payments: paymentRows };
}

export default async function ClientProfilePage({ params }) {
  const env = getEnv();
  const clientId = params?.id;
  if (!clientId) notFound();
  if (!env.studioId) throw new Error('Missing NEXT_PUBLIC_STUDIO_ID');

  const profile = await loadClientProfile({ clientId, studioId: env.studioId });
  if (!profile) notFound();

  const { client, appointments, payments } = profile;
  const timezone = env.studioTimezone || 'Australia/Melbourne';
  const fullName = [client.first_name, client.last_name].filter(Boolean).join(' ');
  const depositPaidTotal = payments
    .filter((p) => p.status === 'succeeded' && p.payment_type === 'deposit')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const allPaidTotal = payments.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalQuoted = appointments
    .filter((a) => !['cancelled', 'no_show'].includes(a.status))
    .reduce((sum, a) => sum + Number(a.quoted_total_amount || 0), 0);
  const successfulAppointments = appointments.filter((a) => !['cancelled', 'no_show'].includes(a.status));
  const firstAppointment = successfulAppointments.length
    ? successfulAppointments.reduce((min, a) => (!min || a.start_at < min ? a.start_at : min), null)
    : null;
  const lastAppointment = successfulAppointments.length
    ? successfulAppointments.reduce((max, a) => (!max || a.start_at > max ? a.start_at : max), null)
    : null;
  const nextDepositDueAppointment = appointments.find((a) => Number(a.deposit_required_amount || 0) > Number(a.deposit_paid_amount || 0));

  return (
    <StudioShell
      title={`Client / ${fullName || 'Client'}`}
      subtitle="Profile, appointment history, payment summary and quick actions."
    >
      <div style={{ display: 'grid', gap: '1rem' }}>
        <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.9rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{fullName || 'Client'}</h3>
              <p style={{ margin: '0.35rem 0 0', opacity: 0.8 }}>
                {client.phone_e164 || 'No phone'} | {client.email || 'No email'}
              </p>
              <p style={{ margin: '0.25rem 0 0', opacity: 0.75, fontSize: 13 }}>
                Status: {client.status || 'active'} | Client Type: {client.client_type || 'new'} | Source: {client.source || '—'} | Instagram: {client.instagram_handle || '—'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'start', flexWrap: 'wrap' }}>
              <Link
                href={`/calendar?clientId=${client.id}`}
                style={{
                  border: '1px solid #2ec4b6',
                  background: 'rgba(46,196,182,0.1)',
                  color: 'inherit',
                  borderRadius: 999,
                  padding: '0.4rem 0.75rem',
                  textDecoration: 'none'
                }}
              >
                Book
              </Link>
              {nextDepositDueAppointment ? (
                <SendDepositEmailButton appointmentId={nextDepositDueAppointment.id} />
              ) : (
                <span style={{ fontSize: 12, opacity: 0.7, paddingTop: 8 }}>No deposit due appointment</span>
              )}
            </div>
          </div>
          {client.notes ? (
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.65rem' }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Notes</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, opacity: 0.9 }}>{client.notes}</div>
            </div>
          ) : null}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ border: '1px solid #333', borderRadius: 12, padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Total Appointments</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{appointments.length}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>First: {firstAppointment ? formatInTimezone(firstAppointment, timezone) : '—'}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Last: {lastAppointment ? formatInTimezone(lastAppointment, timezone) : '—'}</div>
          </div>
          <div style={{ border: '1px solid #333', borderRadius: 12, padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Quoted Appointment Value</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{formatMoney(totalQuoted, env.studioCurrency || 'AUD')}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Non-cancelled/no-show appointments</div>
          </div>
          <div style={{ border: '1px solid #333', borderRadius: 12, padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Payments Received</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{formatMoney(allPaidTotal, env.studioCurrency || 'AUD')}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Deposits: {formatMoney(depositPaidTotal, env.studioCurrency || 'AUD')}</div>
          </div>
          <div style={{ border: '1px solid #333', borderRadius: 12, padding: '0.8rem', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Notification Preferences</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>SMS: {client.sms_opt_in ? 'On' : 'Off'}</div>
            <div style={{ fontSize: 14 }}>Marketing: {client.marketing_opt_in ? 'On' : 'Off'}</div>
          </div>
        </section>

        <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Appointment History</h3>
            <Link href="/clients" style={{ color: 'inherit', opacity: 0.75 }}>Back to Clients</Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #2f2f2f' }}>
                  <th style={{ padding: '0.55rem 0.4rem' }}>When</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Artist</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Service</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Deposit</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Quoted</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => {
                  const artist = getRelationObject(appt.artists);
                  const service = Array.isArray(appt.appointment_services) ? appt.appointment_services[0] : null;
                  const depositReq = Number(appt.deposit_required_amount || 0);
                  const depositPaid = Number(appt.deposit_paid_amount || 0);
                  const depositDue = Math.max(depositReq - depositPaid, 0);
                  return (
                    <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '0.55rem 0.4rem', whiteSpace: 'nowrap' }}>
                        {formatInTimezone(appt.start_at, appt.timezone || timezone)}
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>{artist?.display_name || '—'}</td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>{service?.name_snapshot || 'Appointment'}</td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>
                        <span style={{ border: '1px solid #333', borderRadius: 999, padding: '0.12rem 0.45rem', fontSize: 12 }}>
                          {appt.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem', fontSize: 12 }}>
                        {formatMoney(depositPaid, env.studioCurrency || 'AUD')} / {formatMoney(depositReq, env.studioCurrency || 'AUD')}
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>
                        {appt.quoted_total_amount == null ? '—' : formatMoney(appt.quoted_total_amount, env.studioCurrency || 'AUD')}
                      </td>
                      <td style={{ padding: '0.55rem 0.4rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          <Link
                            href={`/calendar?appointmentId=${appt.id}`}
                            style={{
                              border: '1px solid #333',
                              borderRadius: 999,
                              padding: '0.2rem 0.55rem',
                              color: 'inherit',
                              textDecoration: 'none',
                              fontSize: 12
                            }}
                          >
                            Open
                          </Link>
                          {depositDue > 0 ? <SendDepositEmailButton appointmentId={appt.id} compact /> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '0.75rem 0.4rem', opacity: 0.75 }}>No appointments yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
          <h3 style={{ marginTop: 0, fontSize: 16 }}>Payments</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #2f2f2f' }}>
                  <th style={{ padding: '0.55rem 0.4rem' }}>When</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Type</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Method</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Amount</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Appointment</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.55rem 0.4rem' }}>{payment.paid_at ? formatInTimezone(payment.paid_at, timezone) : formatInTimezone(payment.created_at, timezone)}</td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>{payment.payment_type}</td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>{payment.method}</td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>{payment.status}</td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>{formatMoney(payment.amount, payment.currency || env.studioCurrency || 'AUD')}</td>
                    <td style={{ padding: '0.55rem 0.4rem', fontSize: 12 }}>{payment.appointment_id || '—'}</td>
                  </tr>
                ))}
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '0.75rem 0.4rem', opacity: 0.75 }}>No payments recorded yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </StudioShell>
  );
}
