import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DateTime } from 'luxon';
import {
  addAppointmentCheckoutPayment,
  applyAppointmentManualPriceOverride,
  completeAppointmentCheckout,
  getAppointmentForDepositCheckout,
  getAppointmentOrderSummary
} from '@/lib/services/appointments';
import { createAppointmentPaymentCheckoutSession } from '@/lib/services/stripe';
import { sendEmailViaResend } from '@/lib/services/email';
import { getEnv } from '@/lib/config/env';

const paramsSchema = z.object({ id: z.string().uuid() });

const addPaymentSchema = z.object({
  action: z.literal('add_payment'),
  amount: z.number().positive(),
  method: z.enum(['cash', 'stripe_link', 'bank_transfer'])
});

const overridePriceSchema = z.object({
  action: z.literal('override_price'),
  totalAmount: z.number().min(0),
  note: z.string().max(1000).optional().or(z.literal(''))
});

const completeSchema = z.object({
  action: z.literal('complete_checkout')
});

const sendStripeLinkSchema = z.object({
  action: z.literal('send_stripe_link_email'),
  amount: z.number().positive()
});

const checkoutActionSchema = z.discriminatedUnion('action', [
  addPaymentSchema,
  overridePriceSchema,
  completeSchema,
  sendStripeLinkSchema
]);

function money(amount, currency = 'AUD') {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(Number(amount || 0));
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

export async function POST(request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    const body = await request.json();
    const input = checkoutActionSchema.parse(body);

    let summary;
    if (input.action === 'add_payment') {
      summary = await addAppointmentCheckoutPayment({
        appointmentId: id,
        amount: input.amount,
        method: input.method
      });
    } else if (input.action === 'override_price') {
      summary = await applyAppointmentManualPriceOverride({
        appointmentId: id,
        totalAmount: input.totalAmount,
        note: input.note || ''
      });
    } else if (input.action === 'send_stripe_link_email') {
      const env = getEnv();
      const appointment = await getAppointmentForDepositCheckout(id);
      const orderSummary = await getAppointmentOrderSummary({ appointmentId: id });
      const balanceDue = Number(orderSummary.order?.balanceDueAmount || 0);
      const amount = Number(input.amount || 0);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Stripe link amount must be greater than 0');
      }
      if (amount > balanceDue) {
        throw new Error(`Stripe link amount cannot exceed current balance due (${balanceDue} AUD)`);
      }

      const client = Array.isArray(appointment.clients) ? appointment.clients[0] : appointment.clients;
      const artist = Array.isArray(appointment.artists) ? appointment.artists[0] : appointment.artists;
      const clientEmail = client?.email || '';
      if (!clientEmail && !env.emailTestOverride) {
        throw new Error('Client email is missing');
      }

      const session = await createAppointmentPaymentCheckoutSession({
        appointmentId: id,
        orderId: orderSummary.order?.id,
        clientEmail: clientEmail || undefined,
        amount,
        currency: (env.studioCurrency || 'AUD').toLowerCase(),
        successUrl: `${env.appBaseUrl}/calendar?checkout=success`,
        cancelUrl: `${env.appBaseUrl}/calendar?checkout=cancelled`,
        label: 'Tattoo Appointment Balance Payment'
      });

      const sendTo = env.emailTestOverride || clientEmail;
      const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Client';
      const artistName = artist?.display_name || 'your artist';
      const amountLabel = money(amount, env.studioCurrency || 'AUD');
      const timeLabel = formatAppointmentTime(appointment.start_at, appointment.end_at, appointment.timezone || env.studioTimezone);
      const checkoutUrl = session.url;

      const text = [
        `Hi ${clientName},`,
        '',
        'Here is your payment link for the remaining tattoo appointment balance.',
        `Amount: ${amountLabel}`,
        `Artist: ${artistName}`,
        timeLabel ? `Appointment time: ${timeLabel}` : null,
        `Pay here: ${checkoutUrl}`,
        '',
        env.emailTestOverride && env.emailTestOverride !== clientEmail
          ? `TEST OVERRIDE ACTIVE. Intended recipient: ${clientEmail || '(missing)'}` : null
      ].filter(Boolean).join('\n');

      const html = `<div style=\"font-family:Arial,sans-serif;line-height:1.45;color:#111\">
        <p>Hi ${clientName},</p>
        <p>Here is your payment link for your tattoo appointment balance.</p>
        <ul>
          <li><strong>Amount:</strong> ${amountLabel}</li>
          <li><strong>Artist:</strong> ${artistName}</li>
          ${timeLabel ? `<li><strong>Appointment time:</strong> ${timeLabel}</li>` : ''}
        </ul>
        <p><a href=\"${checkoutUrl}\" style=\"display:inline-block;padding:10px 14px;background:#111;color:#fff;text-decoration:none;border-radius:6px;\">Pay Now</a></p>
        ${env.emailTestOverride && env.emailTestOverride !== clientEmail ? `<p style=\"font-size:12px;color:#777;\">Test override active. Intended recipient: ${clientEmail || '(missing)'}</p>` : ''}
      </div>`;

      await sendEmailViaResend({
        to: sendTo,
        subject: `Payment link for your tattoo appointment (${amountLabel})`,
        html,
        text
      });

      summary = await getAppointmentOrderSummary({ appointmentId: id });
      return NextResponse.json({
        ok: true,
        ...summary,
        stripeLinkSent: true,
        checkoutUrl,
        sessionId: session.id,
        sentTo: sendTo,
        testOverrideApplied: Boolean(env.emailTestOverride && env.emailTestOverride !== clientEmail)
      });
    } else {
      summary = await completeAppointmentCheckout({ appointmentId: id });
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout action failed';
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
