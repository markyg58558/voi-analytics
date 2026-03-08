import { getEnv } from '@/lib/config/env';

export async function sendEmailViaResend({ to, subject, html, text, replyTo }) {
  const env = getEnv();

  if (!env.resendApiKey) {
    throw new Error('Resend is not configured');
  }
  if (!env.emailFrom) {
    throw new Error('EMAIL_FROM is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo || undefined
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Resend email failed (${response.status})`);
  }

  return data;
}

