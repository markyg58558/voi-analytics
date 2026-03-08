import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getEnv } from '@/lib/config/env';
import { processStripeCheckoutCompleted } from '@/lib/services/appointments';

export const runtime = 'nodejs';

export async function POST(request) {
  const env = getEnv();
  const signature = request.headers.get('stripe-signature');

  if (!env.stripeSecretKey || !env.stripeWebhookSecret || !signature) {
    return NextResponse.json({ ok: false, error: 'Stripe webhook not configured' }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    const stripe = new Stripe(env.stripeSecretKey, { apiVersion: '2025-01-27.acacia' });
    const event = stripe.webhooks.constructEvent(rawBody, signature, env.stripeWebhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await processStripeCheckoutCompleted({
        eventId: event.id,
        session
      });
    }

    return NextResponse.json({ ok: true, received: true, type: event.type });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Invalid Stripe webhook' },
      { status: 400 }
    );
  }
}
