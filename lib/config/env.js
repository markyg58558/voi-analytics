const requiredServerVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'APP_BASE_URL'
];

export function getEnv() {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'Tattoo Studio MVP',
    appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    studioId: process.env.NEXT_PUBLIC_STUDIO_ID || '',
    studioTimezone: process.env.STUDIO_TIMEZONE || 'America/New_York',
    studioCurrency: process.env.STUDIO_CURRENCY || 'USD',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || '',
    emailTestOverride: process.env.EMAIL_TEST_OVERRIDE || '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || '',
    twilioWebhookAuthToken: process.env.TWILIO_WEBHOOK_AUTH_TOKEN || ''
  };
}

export function assertServerEnv() {
  const missing = requiredServerVars.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
