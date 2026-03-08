import { NextResponse } from 'next/server';
import {
  createBookingInSupabase,
  isBookingPersistenceConfigured,
  normalizeBookingRequest
} from '@/lib/services/bookings';
import { getEnv } from '@/lib/config/env';

export async function POST(request) {
  try {
    const body = await request.json();
    const payload = normalizeBookingRequest(body);
    const env = getEnv();
    const persistenceEnabled = isBookingPersistenceConfigured();
    const status = payload.service.depositAmount > 0 ? 'pending_deposit' : 'confirmed';

    if (!persistenceEnabled) {
      return NextResponse.json({
        ok: true,
        mode: 'mock',
        warning: 'Supabase service role is not configured; booking was validated but not persisted.',
        booking: {
          status,
          appointment: {
            artistId: payload.artistId,
            studioId: payload.studioId || env.studioId || null,
            startAt: payload.startAt,
            endAt: payload.endAt,
            timezone: payload.timezone
          }
        }
      });
    }

    const result = await createBookingInSupabase(payload);

    return NextResponse.json({
      ok: true,
      booking: {
        status: result.appointment.status,
        client: {
          id: result.client.id,
          firstName: result.client.first_name,
          lastName: result.client.last_name,
          email: result.client.email,
          phoneE164: result.client.phone_e164
        },
        appointment: {
          id: result.appointment.id,
          studioId: result.appointment.studio_id,
          clientId: result.appointment.client_id,
          artistId: result.appointment.artist_id,
          startAt: result.appointment.start_at,
          endAt: result.appointment.end_at,
          timezone: result.appointment.timezone,
          depositRequiredAmount: Number(result.appointment.deposit_required_amount || 0),
          quotedTotalAmount:
            result.appointment.quoted_total_amount == null ? null : Number(result.appointment.quoted_total_amount)
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid booking request';
    const status = error && typeof error === 'object' && error.code === 'BOOKING_CONFLICT' ? 409 : 400;

    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}
