import { NextResponse } from 'next/server';
import {
  listCalendarAppointments,
  mapAppointmentsToCalendarEvents,
  normalizeCalendarEventsQuery
} from '@/lib/services/calendar';

export async function GET(request) {
  try {
    const query = normalizeCalendarEventsQuery(request.nextUrl.searchParams);
    const appointments = await listCalendarAppointments(query);
    const events = mapAppointmentsToCalendarEvents(appointments);

    return NextResponse.json({
      ok: true,
      events,
      count: events.length,
      range: { start: query.start, end: query.end }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load calendar events' },
      { status: 400 }
    );
  }
}
