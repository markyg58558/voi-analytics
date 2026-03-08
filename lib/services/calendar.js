import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const calendarEventsQuerySchema = z.object({
  studioId: z.string().uuid().optional(),
  artistId: z.string().uuid().optional(),
  start: z.string().min(1),
  end: z.string().min(1)
});

export function normalizeCalendarEventsQuery(searchParams) {
  const input = {
    studioId: searchParams.get('studioId') || undefined,
    artistId: searchParams.get('artistId') || undefined,
    start: searchParams.get('start') || '',
    end: searchParams.get('end') || ''
  };

  const parsed = calendarEventsQuerySchema.parse(input);
  const startMs = Date.parse(parsed.start);
  const endMs = Date.parse(parsed.end);

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error('Query start/end must be valid ISO date strings');
  }

  if (startMs >= endMs) {
    throw new Error('Query end must be after start');
  }

  return parsed;
}

export async function listCalendarAppointments({ studioId, artistId, start, end }) {
  const env = getEnv();
  const resolvedStudioId = studioId || env.studioId;

  if (!resolvedStudioId) {
    throw new Error('Missing studioId (query or NEXT_PUBLIC_STUDIO_ID)');
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('appointments')
    .select(
      `
      id,
      studio_id,
      client_id,
      artist_id,
      status,
      source,
      start_at,
      end_at,
      timezone,
      stripe_checkout_session_id,
      deposit_email_sent_at,
      deposit_link_last_generated_at,
      reminder_72h_email_sent_at,
      arrived_at,
      checked_out_at,
      paid_in_full_at,
      deposit_required_amount,
      deposit_paid_amount,
      quoted_total_amount,
      design_brief,
      internal_notes,
      clients:client_id (
        first_name,
        last_name,
        phone_e164,
        email
      ),
      artists:artist_id (
        display_name
      ),
      appointment_services (
        name_snapshot
      )
    `
    )
    .eq('studio_id', resolvedStudioId)
    .lt('start_at', end)
    .gt('end_at', start)
    .order('start_at', { ascending: true });

  if (artistId) {
    query = query.eq('artist_id', artistId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load calendar events: ${error.message}`);
  }

  return data || [];
}

function getRelationObject(value) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function getServiceName(services) {
  if (!Array.isArray(services) || services.length === 0) return 'Appointment';
  return services[0]?.name_snapshot || 'Appointment';
}

export function mapAppointmentsToCalendarEvents(appointments = []) {
  return appointments.map((appt) => {
    const client = getRelationObject(appt.clients);
    const artist = getRelationObject(appt.artists);
    const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Client';
    const serviceName = getServiceName(appt.appointment_services);

    return {
      id: appt.id,
      title: `${clientName} • ${serviceName}`,
      start: appt.start_at,
      end: appt.end_at,
      extendedProps: {
        appointmentId: appt.id,
        studioId: appt.studio_id,
        clientId: appt.client_id,
        artistId: appt.artist_id,
        artistName: artist?.display_name || null,
        status: appt.status,
        source: appt.source,
        timezone: appt.timezone,
        stripeCheckoutSessionId: appt.stripe_checkout_session_id || null,
        depositEmailSentAt: appt.deposit_email_sent_at || null,
        depositLinkLastGeneratedAt: appt.deposit_link_last_generated_at || null,
        reminder72hEmailSentAt: appt.reminder_72h_email_sent_at || null,
        arrivedAt: appt.arrived_at || null,
        checkedOutAt: appt.checked_out_at || null,
        paidInFullAt: appt.paid_in_full_at || null,
        depositPaidAmount: Number(appt.deposit_paid_amount || 0),
        depositRequiredAmount: Number(appt.deposit_required_amount || 0),
        quotedTotalAmount: appt.quoted_total_amount == null ? null : Number(appt.quoted_total_amount),
        phoneE164: client?.phone_e164 || null,
        email: client?.email || null,
        designBrief: appt.design_brief || null,
        internalNotes: appt.internal_notes || null,
        serviceName
      }
    };
  });
}
