'use client';

import { useState } from 'react';

const initialForm = {
  studioId: '',
  artistId: '',
  firstName: '',
  lastName: '',
  email: '',
  phoneE164: '',
  smsOptIn: true,
  serviceName: 'Tattoo Session',
  durationMinutes: '120',
  quotedPrice: '',
  depositAmount: '100',
  startAtLocal: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
  designBrief: ''
};

function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'grid', gap: '0.35rem' }}>
      <span style={{ fontSize: 14, opacity: 0.9 }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 12, opacity: 0.65 }}>{hint}</span> : null}
    </label>
  );
}

export default function BookingIntakeForm() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const payload = {
        studioId: form.studioId || undefined,
        artistId: form.artistId,
        client: {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phoneE164: form.phoneE164,
          smsOptIn: form.smsOptIn
        },
        service: {
          name: form.serviceName,
          durationMinutes: Number(form.durationMinutes),
          quotedPrice: form.quotedPrice === '' ? undefined : Number(form.quotedPrice),
          depositAmount: Number(form.depositAmount || 0)
        },
        startAt: new Date(form.startAtLocal).toISOString(),
        timezone: form.timezone,
        designBrief: form.designBrief
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      setResult({
        ok: response.ok && data.ok,
        status: response.status,
        data
      });
    } catch (error) {
      setResult({
        ok: false,
        status: 0,
        data: { ok: false, error: error instanceof Error ? error.message : 'Network error' }
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <article style={{ border: '1px solid #2e2e2e', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ marginTop: 0 }}>Public Booking Intake</h2>
        <p style={{ marginTop: 0, opacity: 0.8 }}>
          Working MVP form that validates and creates appointments via <code>/api/bookings</code>. Artist selection is a
          temporary UUID field until the availability UI is wired.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <Field label="Studio ID (optional)">
              <input
                value={form.studioId}
                onChange={(e) => updateField('studioId', e.target.value)}
                placeholder="Uses NEXT_PUBLIC_STUDIO_ID if blank"
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Artist ID (UUID)" hint="Required until artist picker is added">
              <input
                required
                value={form.artistId}
                onChange={(e) => updateField('artistId', e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <Field label="First name">
              <input
                required
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Last name">
              <input
                required
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Phone (E.164)">
              <input
                required
                value={form.phoneE164}
                onChange={(e) => updateField('phoneE164', e.target.value)}
                placeholder="+15551234567"
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Email (optional)">
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <Field label="Service name">
              <input
                required
                value={form.serviceName}
                onChange={(e) => updateField('serviceName', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                required
                type="number"
                min="1"
                value={form.durationMinutes}
                onChange={(e) => updateField('durationMinutes', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Quoted price (optional)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.quotedPrice}
                onChange={(e) => updateField('quotedPrice', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Deposit amount">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.depositAmount}
                onChange={(e) => updateField('depositAmount', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <Field label="Appointment start (local)">
              <input
                required
                type="datetime-local"
                value={form.startAtLocal}
                onChange={(e) => updateField('startAtLocal', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
            <Field label="Timezone">
              <input
                required
                value={form.timezone}
                onChange={(e) => updateField('timezone', e.target.value)}
                style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
              />
            </Field>
          </div>

          <Field label="Design brief (optional)">
            <textarea
              rows={4}
              value={form.designBrief}
              onChange={(e) => updateField('designBrief', e.target.value)}
              style={{ padding: '0.65rem', borderRadius: 8, border: '1px solid #333', background: 'transparent' }}
            />
          </Field>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.smsOptIn}
              onChange={(e) => updateField('smsOptIn', e.target.checked)}
            />
            <span>SMS reminders / follow-up opt-in</span>
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.7rem 0.95rem',
                borderRadius: 10,
                border: '1px solid #333',
                background: submitting ? '#1f1f1f' : '#111',
                color: 'inherit',
                cursor: submitting ? 'progress' : 'pointer'
              }}
            >
              {submitting ? 'Submitting...' : 'Create Booking'}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setResult(null);
              }}
              disabled={submitting}
              style={{
                padding: '0.7rem 0.95rem',
                borderRadius: 10,
                border: '1px solid #333',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </article>

      <article style={{ border: '1px solid #2e2e2e', borderRadius: 12, padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Response</h3>
        {result ? (
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 13,
              lineHeight: 1.45,
              color: result.ok ? 'inherit' : '#ffb4b4'
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : (
          <p style={{ margin: 0, opacity: 0.75 }}>
            Submit a booking to see validation errors, conflict responses (`409`), or a persisted appointment payload.
          </p>
        )}
      </article>
    </section>
  );
}
