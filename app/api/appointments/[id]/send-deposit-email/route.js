import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { getEnv } from '@/lib/config/env';
import { createDepositCheckoutSession } from '@/lib/services/stripe';
import { sendEmailViaResend } from '@/lib/services/email';
import {
  attachCheckoutSessionToAppointment,
  getAppointmentForDepositCheckout,
  isAppointmentPersistenceConfigured,
  markDepositEmailSentOnAppointment
} from '@/lib/services/appointments';

const paramsSchema = z.object({
  id: z.string().uuid()
});

function money(amount, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency
  }).format(Number(amount || 0));
}

function formatAppointmentTime(startAt, endAt, timezone) {
  if (!startAt || !endAt) return null;
  try {
    const start = DateTime.fromISO(startAt, { zone: 'utc' }).setZone(timezone);
    const end = DateTime.fromISO(endAt, { zone: 'utc' }).setZone(timezone);
    return `${start.toFormat("cccc d LLL yyyy, h:mm a")} - ${end.toFormat('h:mm a')} (${timezone})`;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(_request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    if (!isAppointmentPersistenceConfigured()) {
      return NextResponse.json({ ok: false, error: 'Supabase service role is not configured' }, { status: 500 });
    }

    const env = getEnv();
    const appointment = await getAppointmentForDepositCheckout(id);
    if (appointment.deposit_remaining_amount <= 0) {
      return NextResponse.json({ ok: false, error: 'Deposit is already fully paid' }, { status: 400 });
    }

    const client = Array.isArray(appointment.clients) ? appointment.clients[0] : appointment.clients;
    const artist = Array.isArray(appointment.artists) ? appointment.artists[0] : appointment.artists;
    const clientEmail = client?.email || '';
    if (!clientEmail && !env.emailTestOverride) {
      return NextResponse.json({ ok: false, error: 'Client email is missing' }, { status: 400 });
    }

    const session = await createDepositCheckoutSession({
      appointmentId: id,
      clientEmail: clientEmail || undefined,
      amount: appointment.deposit_remaining_amount,
      currency: env.studioCurrency.toLowerCase(),
      successUrl: `${env.appBaseUrl}/calendar?deposit=success`,
      cancelUrl: `${env.appBaseUrl}/calendar?deposit=cancelled`
    });

    await attachCheckoutSessionToAppointment({ appointmentId: id, sessionId: session.id });

    const sendTo = env.emailTestOverride || clientEmail;
    const intendedRecipient = clientEmail || '(missing in client record)';
    const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Client';
    const amountLabel = money(appointment.deposit_remaining_amount, env.studioCurrency || 'AUD');
    const timeLabel = formatAppointmentTime(appointment.start_at, appointment.end_at, appointment.timezone || env.studioTimezone);
    const artistName = artist?.display_name || 'your artist';
    const checkoutUrl = session.url;

    const subject = `Deposit payment link for your tattoo appointment (${amountLabel})`;
    const testOverrideNotice =
      env.emailTestOverride && env.emailTestOverride !== clientEmail
        ? `<p style="font-size:12px;color:#777;">Test override active. Intended recipient: ${escapeHtml(intendedRecipient)}</p>`
        : '';

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.45;color:#111">
        <p>Hi ${escapeHtml(clientName)},</p>
        <p>Here is your deposit payment link for your tattoo appointment.</p>
        <ul>
          <li><strong>Deposit amount:</strong> ${escapeHtml(amountLabel)}</li>
          <li><strong>Artist:</strong> ${escapeHtml(artistName)}</li>
          ${timeLabel ? `<li><strong>Appointment time:</strong> ${escapeHtml(timeLabel)}</li>` : ''}
        </ul>
        <p>
          <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
            Pay Deposit
          </a>
        </p>
        <p>If you have any questions, reply to this email.</p>
        ${testOverrideNotice}
      </div>
    `;

    const text = [
      `Hi ${clientName},`,
      '',
      'Here is your tattoo appointment deposit payment link.',
      `Deposit amount: ${amountLabel}`,
      `Artist: ${artistName}`,
      timeLabel ? `Appointment time: ${timeLabel}` : null,
      `Pay here: ${checkoutUrl}`,
      '',
      env.emailTestOverride && env.emailTestOverride !== clientEmail
        ? `TEST OVERRIDE ACTIVE. Intended recipient: ${intendedRecipient}`
        : null
    ]
      .filter(Boolean)
      .join('\n');

    const resendResult = await sendEmailViaResend({
      to: sendTo,
      subject,
      html,
      text
    });

    await markDepositEmailSentOnAppointment({ appointmentId: id });

    return NextResponse.json({
      ok: true,
      sentTo: sendTo,
      intendedRecipient,
      testOverrideApplied: Boolean(env.emailTestOverride && env.emailTestOverride !== clientEmail),
      checkoutUrl,
      sessionId: session.id,
      emailId: resendResult?.id || null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send deposit email';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
