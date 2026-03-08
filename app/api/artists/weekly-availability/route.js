import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const entrySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  active: z.boolean(),
  startLocalTime: z.string().regex(timePattern).optional().nullable(),
  endLocalTime: z.string().regex(timePattern).optional().nullable()
});

const putSchema = z.object({
  studioId: z.string().uuid().optional(),
  artistId: z.string().uuid(),
  timezone: z.string().min(1).optional(),
  entries: z.array(entrySchema).length(7)
});

function mapAvailabilityRow(row) {
  return {
    id: row.id,
    studioId: row.studio_id,
    artistId: row.artist_id,
    dayOfWeek: row.day_of_week,
    startLocalTime: row.start_local_time || null,
    endLocalTime: row.end_local_time || null,
    timezone: row.timezone,
    active: Boolean(row.active)
  };
}

export async function GET(request) {
  try {
    const env = getEnv();
    const studioId = request.nextUrl.searchParams.get('studioId') || env.studioId;
    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const [{ data: artists, error: artistsError }, { data: availability, error: availError }] = await Promise.all([
      supabase
        .from('artists')
        .select('id,studio_id,display_name,active')
        .eq('studio_id', studioId)
        .order('display_name', { ascending: true }),
      supabase
        .from('artist_weekly_availability')
        .select('id,studio_id,artist_id,day_of_week,start_local_time,end_local_time,timezone,active')
        .eq('studio_id', studioId)
        .order('artist_id', { ascending: true })
        .order('day_of_week', { ascending: true })
    ]);

    if (artistsError) throw new Error(artistsError.message);
    if (availError) throw new Error(availError.message);

    const availabilityByArtist = new Map();
    for (const row of availability || []) {
      const list = availabilityByArtist.get(row.artist_id) || [];
      list.push(mapAvailabilityRow(row));
      availabilityByArtist.set(row.artist_id, list);
    }

    return NextResponse.json({
      ok: true,
      artists: (artists || []).map((a) => ({
        id: a.id,
        studioId: a.studio_id,
        displayName: a.display_name,
        active: Boolean(a.active),
        weeklyAvailability: availabilityByArtist.get(a.id) || []
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load weekly availability' },
      { status: 400 }
    );
  }
}

export async function PUT(request) {
  try {
    const env = getEnv();
    const body = await request.json();
    const input = putSchema.parse(body);
    const studioId = input.studioId || env.studioId;
    const timezone = input.timezone || env.studioTimezone || 'Australia/Melbourne';

    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    // Validate active rows have times
    for (const row of input.entries) {
      if (row.active) {
        if (!row.startLocalTime || !row.endLocalTime) {
          return NextResponse.json(
            { ok: false, error: `Day ${row.dayOfWeek}: start and end times are required when active` },
            { status: 400 }
          );
        }
        if (row.endLocalTime <= row.startLocalTime) {
          return NextResponse.json(
            { ok: false, error: `Day ${row.dayOfWeek}: end time must be after start time` },
            { status: 400 }
          );
        }
      }
    }

    const supabase = getSupabaseAdminClient();
    const payload = input.entries.map((row) => ({
      studio_id: studioId,
      artist_id: input.artistId,
      day_of_week: row.dayOfWeek,
      start_local_time: row.active ? (row.startLocalTime || null) : null,
      end_local_time: row.active ? (row.endLocalTime || null) : null,
      timezone,
      active: row.active
    }));

    const { data, error } = await supabase
      .from('artist_weekly_availability')
      .upsert(payload, { onConflict: 'artist_id,day_of_week' })
      .select('id,studio_id,artist_id,day_of_week,start_local_time,end_local_time,timezone,active')
      .order('day_of_week', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      artistId: input.artistId,
      weeklyAvailability: (data || []).map(mapAvailabilityRow)
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save weekly availability' },
      { status: 400 }
    );
  }
}

