import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const createArtistSchema = z.object({
  studioId: z.string().uuid().optional(),
  displayName: z.string().min(1).max(120),
  firstName: z.string().max(80).optional().or(z.literal('')),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phoneE164: z.string().max(30).optional().or(z.literal('')),
  commissionRatePct: z.coerce.number().min(0).max(100).optional().nullable(),
  gstRegistered: z.boolean().optional(),
  active: z.boolean().optional(),
  abn: z.string().max(80).optional().or(z.literal(''))
});

function normalizeAustralianPhoneToE164(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (/^0\d{9}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^61\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9,15}$/.test(digits)) return `+${digits}`;
  return value;
}

export async function GET(request) {
  try {
    const env = getEnv();
    const studioId = request.nextUrl.searchParams.get('studioId') || env.studioId;
    const includeInactive = ['1', 'true', 'yes'].includes(
      String(request.nextUrl.searchParams.get('includeInactive') || '').toLowerCase()
    );

    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('artists')
      .select('id,studio_id,display_name,first_name,last_name,email,phone_e164,name_normalized,commission_rate_pct,gst_registered,abn,active')
      .eq('studio_id', studioId)
      .order('display_name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      artists: (data || []).map((artist) => ({
        id: artist.id,
        studioId: artist.studio_id,
        displayName: artist.display_name,
        firstName: artist.first_name || null,
        lastName: artist.last_name || null,
        email: artist.email || null,
        phoneE164: artist.phone_e164 || null,
        nameNormalized: artist.name_normalized || null,
        commissionRatePct:
          artist.commission_rate_pct == null ? null : Number(artist.commission_rate_pct),
        gstRegistered: artist.gst_registered == null ? null : Boolean(artist.gst_registered),
        abn: artist.abn || null,
        active: artist.active
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load artists' },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  try {
    const env = getEnv();
    const body = await request.json();
    const input = createArtistSchema.parse(body);
    const studioId = input.studioId || env.studioId;

    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('artists')
      .insert({
        studio_id: studioId,
        display_name: input.displayName.trim(),
        first_name: input.firstName?.trim() || null,
        last_name: input.lastName?.trim() || null,
        email: input.email?.trim() || null,
        phone_e164: normalizeAustralianPhoneToE164(input.phoneE164),
        name_normalized: input.displayName.trim().toLowerCase(),
        commission_rate_pct: input.commissionRatePct ?? null,
        gst_registered: input.gstRegistered ?? false,
        abn: input.abn?.trim() || null,
        active: input.active ?? true
      })
      .select('id,studio_id,display_name,first_name,last_name,email,phone_e164,name_normalized,commission_rate_pct,gst_registered,abn,active')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      artist: {
        id: data.id,
        studioId: data.studio_id,
        displayName: data.display_name,
        firstName: data.first_name || null,
        lastName: data.last_name || null,
        email: data.email || null,
        phoneE164: data.phone_e164 || null,
        nameNormalized: data.name_normalized || null,
        commissionRatePct: data.commission_rate_pct == null ? null : Number(data.commission_rate_pct),
        gstRegistered: data.gst_registered == null ? null : Boolean(data.gst_registered),
        abn: data.abn || null,
        active: data.active
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create artist' },
      { status: 400 }
    );
  }
}
