import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isAppointmentPersistenceConfigured,
  normalizeAppointmentPatchRequest,
  updateAppointmentInSupabase
} from '@/lib/services/appointments';

const paramsSchema = z.object({
  id: z.string().uuid()
});

export async function PATCH(request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    const body = await request.json();
    const patch = normalizeAppointmentPatchRequest(body);

    if (!isAppointmentPersistenceConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Supabase service role is not configured' },
        { status: 500 }
      );
    }

    const updated = await updateAppointmentInSupabase({ appointmentId: id, patch });

    return NextResponse.json({
      ok: true,
      appointment: {
        id: updated.id,
        studioId: updated.studio_id,
        clientId: updated.client_id,
        artistId: updated.artist_id,
        status: updated.status,
        source: updated.source,
        startAt: updated.start_at,
        endAt: updated.end_at,
        timezone: updated.timezone,
        depositRequiredAmount: Number(updated.deposit_required_amount || 0),
        depositPaidAmount: Number(updated.deposit_paid_amount || 0),
        quotedTotalAmount: updated.quoted_total_amount == null ? null : Number(updated.quoted_total_amount),
        designBrief: updated.design_brief,
        internalNotes: updated.internal_notes,
        depositEmailSentAt: updated.deposit_email_sent_at || null,
        depositLinkLastGeneratedAt: updated.deposit_link_last_generated_at || null,
        reminder72hEmailSentAt: updated.reminder_72h_email_sent_at || null,
        arrivedAt: updated.arrived_at || null,
        checkedOutAt: updated.checked_out_at || null,
        paidInFullAt: updated.paid_in_full_at || null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid appointment update request';
    let status = 400;
    if (error && typeof error === 'object' && error.code === 'BOOKING_CONFLICT') status = 409;
    if (error && typeof error === 'object' && error.code === 'NOT_FOUND') status = 404;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
