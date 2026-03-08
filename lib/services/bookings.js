import { z } from 'zod';
import { addMinutes, isValidRange } from '@/lib/utils/datetime';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

export const bookingRequestSchema = z.object({
  studioId: z.string().uuid().optional(),
  artistId: z.string().uuid(),
  client: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email().optional().or(z.literal('')),
    phoneE164: z.string().min(8),
    smsOptIn: z.boolean().default(true)
  }),
  service: z.object({
    name: z.string().min(1),
    durationMinutes: z.number().int().positive(),
    quotedPrice: z.number().nonnegative().optional(),
    depositAmount: z.number().nonnegative().default(0)
  }),
  startAt: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  designBrief: z.string().max(4000).optional().or(z.literal(''))
});

export function deriveAppointmentTimes({ startAt, durationMinutes }) {
  const startDate = new Date(startAt);
  const endDate = addMinutes(startDate, durationMinutes);
  return {
    startAt: startDate.toISOString(),
    endAt: endDate.toISOString()
  };
}

export function validateAppointmentRange({ startAt, endAt }) {
  if (!isValidRange(startAt, endAt)) {
    throw new Error('Appointment end time must be after start time');
  }
}

export function normalizeBookingRequest(payload) {
  const parsed = bookingRequestSchema.parse(payload);
  const range = deriveAppointmentTimes({
    startAt: parsed.startAt,
    durationMinutes: parsed.service.durationMinutes
  });

  validateAppointmentRange(range);
  return { ...parsed, ...range };
}

export function isBookingPersistenceConfigured() {
  const env = getEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

function isBlockingAppointmentStatus(status) {
  return !['cancelled', 'no_show'].includes(String(status || ''));
}

export async function assertNoArtistOverlap({ artistId, startAt, endAt, excludeAppointmentId }) {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('appointments')
    .select('id,status,start_at,end_at')
    .eq('artist_id', artistId)
    .lt('start_at', endAt)
    .gt('end_at', startAt);

  if (excludeAppointmentId) {
    query = query.neq('id', excludeAppointmentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to validate availability: ${error.message}`);
  }

  const conflicting = (data || []).find((row) => isBlockingAppointmentStatus(row.status));
  if (conflicting) {
    const conflictError = new Error('Selected time overlaps an existing appointment');
    conflictError.code = 'BOOKING_CONFLICT';
    conflictError.details = conflicting;
    throw conflictError;
  }
}

export async function findOrCreateClient({
  studioId,
  firstName,
  lastName,
  phoneE164,
  email,
  smsOptIn
}) {
  const supabase = getSupabaseAdminClient();

  if (phoneE164) {
    const { data, error } = await supabase
      .from('clients')
      .select('id,first_name,last_name,phone_e164,email')
      .eq('studio_id', studioId)
      .eq('phone_e164', phoneE164)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup client by phone: ${error.message}`);
    }
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from('clients')
      .select('id,first_name,last_name,phone_e164,email')
      .eq('studio_id', studioId)
      .eq('email', email)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup client by email: ${error.message}`);
    }
    if (data) return data;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('clients')
    .insert({
      studio_id: studioId,
      first_name: firstName,
      last_name: lastName,
      phone_e164: phoneE164 || null,
      email: email || null,
      sms_opt_in: smsOptIn
    })
    .select('id,first_name,last_name,phone_e164,email')
    .single();

  if (insertError) {
    throw new Error(`Failed to create client: ${insertError.message}`);
  }

  return inserted;
}

export async function createBookingInSupabase(payload) {
  const env = getEnv();
  const studioId = payload.studioId || env.studioId;

  if (!studioId) {
    throw new Error('Missing studioId (request or NEXT_PUBLIC_STUDIO_ID)');
  }

  await assertNoArtistOverlap({
    artistId: payload.artistId,
    startAt: payload.startAt,
    endAt: payload.endAt
  });

  const client = await findOrCreateClient({
    studioId,
    firstName: payload.client.firstName,
    lastName: payload.client.lastName,
    phoneE164: payload.client.phoneE164,
    email: payload.client.email,
    smsOptIn: payload.client.smsOptIn
  });

  const appointmentStatus = payload.service.depositAmount > 0 ? 'pending_deposit' : 'confirmed';
  const supabase = getSupabaseAdminClient();

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      studio_id: studioId,
      client_id: client.id,
      artist_id: payload.artistId,
      status: appointmentStatus,
      source: 'online',
      start_at: payload.startAt,
      end_at: payload.endAt,
      timezone: payload.timezone,
      deposit_required_amount: payload.service.depositAmount,
      quoted_total_amount: payload.service.quotedPrice ?? null,
      design_brief: payload.designBrief || null
    })
    .select(
      'id,studio_id,client_id,artist_id,status,start_at,end_at,timezone,deposit_required_amount,quoted_total_amount,created_at'
    )
    .single();

  if (error) {
    throw new Error(`Failed to create appointment: ${error.message}`);
  }

  const { error: serviceRowError } = await supabase.from('appointment_services').insert({
    appointment_id: appointment.id,
    name_snapshot: payload.service.name,
    duration_minutes: payload.service.durationMinutes,
    unit_price: payload.service.quotedPrice ?? null,
    quantity: 1,
    artist_id: payload.artistId
  });

  if (serviceRowError) {
    throw new Error(`Appointment created but service line insert failed: ${serviceRowError.message}`);
  }

  return { studioId, client, appointment };
}
