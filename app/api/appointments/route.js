import { NextResponse } from 'next/server';
import { getEnv } from '@/lib/config/env';
import {
  createAppointmentInSupabase,
  isAppointmentPersistenceConfigured,
  normalizeAppointmentCreateRequest
} from '@/lib/services/appointments';

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = normalizeAppointmentCreateRequest(body);
    const env = getEnv();

    if (!isAppointmentPersistenceConfigured()) {
      const status = payload.depositRequiredAmount > 0 ? 'pending_deposit' : 'confirmed';
      return NextResponse.json({
        ok: true,
        mode: 'mock',
        warning: 'Supabase service role is not configured; appointment was validated but not persisted.',
        appointment: {
          status,
          source: payload.source,
          studioId: payload.studioId || env.studioId || null,
          artistId: payload.artistId,
          startAt: payload.startAt,
          endAt: payload.endAt,
          timezone: payload.timezone
        }
      });
    }

    const result = await createAppointmentInSupabase(payload);

    return NextResponse.json({
      ok: true,
      appointment: {
        id: result.appointment.id,
        studioId: result.appointment.studio_id,
        clientId: result.appointment.client_id,
        artistId: result.appointment.artist_id,
        status: result.appointment.status,
        source: result.appointment.source,
        startAt: result.appointment.start_at,
        endAt: result.appointment.end_at,
        timezone: result.appointment.timezone,
        depositRequiredAmount: Number(result.appointment.deposit_required_amount || 0),
        depositPaidAmount: Number(result.appointment.deposit_paid_amount || 0),
        quotedTotalAmount:
          result.appointment.quoted_total_amount == null ? null : Number(result.appointment.quoted_total_amount),
        designBrief: result.appointment.design_brief,
        internalNotes: result.appointment.internal_notes,
        depositEmailSentAt: result.appointment.deposit_email_sent_at || null,
        depositLinkLastGeneratedAt: result.appointment.deposit_link_last_generated_at || null,
        reminder72hEmailSentAt: result.appointment.reminder_72h_email_sent_at || null,
        arrivedAt: result.appointment.arrived_at || null,
        checkedOutAt: result.appointment.checked_out_at || null,
        paidInFullAt: result.appointment.paid_in_full_at || null
      },
      client: {
        id: result.client.id,
        firstName: result.client.first_name,
        lastName: result.client.last_name,
        phoneE164: result.client.phone_e164,
        email: result.client.email
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid appointment request';
    const status = error && typeof error === 'object' && error.code === 'BOOKING_CONFLICT' ? 409 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
