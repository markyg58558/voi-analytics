import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const querySchema = z.object({
  studioId: z.string().uuid().optional(),
  artistId: z.string().uuid().optional(),
  start: z.string().min(1),
  end: z.string().min(1)
});

const createBlockSchema = z.object({
  studioId: z.string().uuid().optional(),
  artistId: z.string().uuid(),
  blockType: z.enum(['time_off', 'rostered_unavailable', 'break', 'busy_hold']),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  timezone: z.string().min(1),
  label: z.string().max(120).optional().or(z.literal('')),
  note: z.string().max(1000).optional().or(z.literal('')),
  colorHex: z.string().max(20).optional().or(z.literal('')),
  affectsBooking: z.boolean().default(true)
});

export async function GET(request) {
  try {
    const raw = {
      studioId: request.nextUrl.searchParams.get('studioId') || undefined,
      artistId: request.nextUrl.searchParams.get('artistId') || undefined,
      start: request.nextUrl.searchParams.get('start') || '',
      end: request.nextUrl.searchParams.get('end') || ''
    };
    const query = querySchema.parse(raw);
    const startMs = Date.parse(query.start);
    const endMs = Date.parse(query.end);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
      return NextResponse.json({ ok: false, error: 'Invalid date range' }, { status: 400 });
    }

    const env = getEnv();
    const studioId = query.studioId || env.studioId;
    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    let dbQuery = supabase
      .from('artist_availability_blocks')
      .select('id,studio_id,artist_id,block_type,start_at,end_at,timezone,label,note,color_hex,affects_booking')
      .eq('studio_id', studioId)
      .lt('start_at', query.end)
      .gt('end_at', query.start)
      .order('start_at', { ascending: true });

    if (query.artistId) {
      dbQuery = dbQuery.eq('artist_id', query.artistId);
    }

    const { data, error } = await dbQuery;

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({
          ok: true,
          blocks: [],
          warning: 'artist_availability_blocks table not found yet. Apply migration 20260223_002.'
        });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      blocks: (data || []).map((row) => ({
        id: row.id,
        studioId: row.studio_id,
        artistId: row.artist_id,
        blockType: row.block_type,
        startAt: row.start_at,
        endAt: row.end_at,
        timezone: row.timezone,
        label: row.label,
        note: row.note,
        colorHex: row.color_hex,
        affectsBooking: row.affects_booking
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load availability blocks' },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const input = createBlockSchema.parse(body);
    if (Date.parse(input.startAt) >= Date.parse(input.endAt)) {
      return NextResponse.json({ ok: false, error: 'endAt must be after startAt' }, { status: 400 });
    }

    const env = getEnv();
    const studioId = input.studioId || env.studioId;
    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('artist_availability_blocks')
      .insert({
        studio_id: studioId,
        artist_id: input.artistId,
        block_type: input.blockType,
        start_at: input.startAt,
        end_at: input.endAt,
        timezone: input.timezone,
        label: input.label || null,
        note: input.note || null,
        color_hex: input.colorHex || null,
        affects_booking: input.affectsBooking
      })
      .select('id,studio_id,artist_id,block_type,start_at,end_at,timezone,label,note,color_hex,affects_booking')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      block: {
        id: data.id,
        studioId: data.studio_id,
        artistId: data.artist_id,
        blockType: data.block_type,
        startAt: data.start_at,
        endAt: data.end_at,
        timezone: data.timezone,
        label: data.label,
        note: data.note,
        colorHex: data.color_hex,
        affectsBooking: data.affects_booking
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create availability block' },
      { status: 400 }
    );
  }
}
