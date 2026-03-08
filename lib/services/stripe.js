import Stripe from 'stripe';
import { getEnv } from '@/lib/config/env';
import { toCents } from '@/lib/utils/money';

let stripe;

export function getStripeClient() {
  if (stripe) return stripe;

  const env = getEnv();
  if (!env.stripeSecretKey) {
    throw new Error('Stripe is not configured');
  }

  stripe = new Stripe(env.stripeSecretKey, {
    apiVersion: '2025-01-27.acacia'
  });

  return stripe;
}

export async function createDepositCheckoutSession({
  appointmentId,
  orderId,
  clientEmail,
  amount,
  currency = 'usd',
  successUrl,
  cancelUrl
}) {
  const stripeClient = getStripeClient();

  return stripeClient.checkout.sessions.create({
    mode: 'payment',
    customer_email: clientEmail || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { appointmentId, paymentType: 'deposit', orderId: orderId || '' },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: toCents(amount),
          product_data: { name: 'Tattoo Appointment Deposit' }
        }
      }
    ]
  });
}

export async function createAppointmentPaymentCheckoutSession({
  appointmentId,
  orderId,
  clientEmail,
  amount,
  currency = 'usd',
  successUrl,
  cancelUrl,
  label = 'Tattoo Appointment Payment'
}) {
  const stripeClient = getStripeClient();

  return stripeClient.checkout.sessions.create({
    mode: 'payment',
    customer_email: clientEmail || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { appointmentId, paymentType: 'final', orderId: orderId || '' },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: toCents(amount),
          product_data: { name: label }
        }
      }
    ]
  });
}
