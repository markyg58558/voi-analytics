import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppointmentOrderSummary } from '@/lib/services/appointments';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const paramsSchema = z.object({
  id: z.string().uuid()
});

export async function GET(_request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    const summary = await getAppointmentOrderSummary({ appointmentId: id });
    return NextResponse.json(
      { ok: true, ...summary },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load checkout summary';
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
