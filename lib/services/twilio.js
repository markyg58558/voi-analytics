import twilio from 'twilio';
import { getEnv } from '@/lib/config/env';

let twilioClient;

export function getTwilioClient() {
  if (twilioClient) return twilioClient;

  const env = getEnv();
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    throw new Error('Twilio is not configured');
  }

  twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
  return twilioClient;
}

export async function sendSms({ to, body }) {
  const env = getEnv();
  const client = getTwilioClient();

  if (!env.twilioMessagingServiceSid) {
    throw new Error('Twilio messaging service SID is not configured');
  }

  return client.messages.create({
    to,
    body,
    messagingServiceSid: env.twilioMessagingServiceSid
  });
}
