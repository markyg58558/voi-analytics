import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createDepositCheckoutSession } from '@/lib/services/stripe';
import { getEnv } from '@/lib/config/env';
import {
  attachCheckoutSessionToAppointment,
  getAppointmentForDepositCheckout,
  isAppointmentPersistenceConfigured
} from '@/lib/services/appointments';

const checkoutSchema = z.object({
  appointmentId: z.string().min(1),
  clientEmail: z.string().email().optional(),
  depositAmount: z.number().positive()
}).partial({ clientEmail: true, depositAmount: true });

export async function POST(request) {
  try {
    const body = await request.json();
    const input = checkoutSchema.parse(body);
    const env = getEnv();
    let amount = input.depositAmount;
    let clientEmail = input.clientEmail;

    if (isAppointmentPersistenceConfigured()) {
      const appointment = await getAppointmentForDepositCheckout(input.appointmentId);
      if (appointment.deposit_remaining_amount <= 0) {
        return NextResponse.json({ ok: false, error: 'Deposit is already fully paid' }, { status: 400 });
      }
      amount = amount ?? appointment.deposit_remaining_amount;
      const client = Array.isArray(appointment.clients) ? appointment.clients[0] : appointment.clients;
      clientEmail = clientEmail || client?.email || undefined;
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: 'Missing deposit amount' }, { status: 400 });
    }

    const session = await createDepositCheckoutSession({
      appointmentId: input.appointmentId,
      clientEmail,
      amount,
      currency: env.studioCurrency.toLowerCase(),
      successUrl: `${env.appBaseUrl}/calendar?deposit=success`,
      cancelUrl: `${env.appBaseUrl}/calendar?deposit=cancelled`
    });

    if (isAppointmentPersistenceConfigured()) {
      await attachCheckoutSessionToAppointment({
        appointmentId: input.appointmentId,
        sessionId: session.id
      });
    }

    return NextResponse.json({ ok: true, checkoutUrl: session.url, sessionId: session.id, amount });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Checkout session failed' },
      { status: 400 }
    );
  }
}
