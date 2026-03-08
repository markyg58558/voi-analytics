import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const paramsSchema = z.object({
  id: z.string().uuid()
});

const patchArtistSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  firstName: z.string().max(80).optional().or(z.literal('')),
  lastName: z.string().max(80).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  phoneE164: z.string().max(30).optional().or(z.literal('')),
  commissionRatePct: z.coerce.number().min(0).max(100).optional().nullable(),
  gstRegistered: z.boolean().optional().nullable(),
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

export async function PATCH(request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    const body = await request.json();
    const input = patchArtistSchema.parse(body);

    const patch = {};
    if (input.displayName !== undefined) {
      const displayName = input.displayName.trim();
      patch.display_name = displayName;
      patch.name_normalized = displayName.toLowerCase();
    }
    if (input.firstName !== undefined) patch.first_name = input.firstName?.trim() || null;
    if (input.lastName !== undefined) patch.last_name = input.lastName?.trim() || null;
    if (input.email !== undefined) patch.email = input.email?.trim() || null;
    if (input.phoneE164 !== undefined) patch.phone_e164 = normalizeAustralianPhoneToE164(input.phoneE164);
    if (input.commissionRatePct !== undefined) patch.commission_rate_pct = input.commissionRatePct;
    if (input.gstRegistered !== undefined) patch.gst_registered = input.gstRegistered;
    if (input.active !== undefined) patch.active = input.active;
    if (input.abn !== undefined) patch.abn = input.abn?.trim() || null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: 'No changes provided' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('artists')
      .update(patch)
      .eq('id', id)
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
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update artist' },
      { status: 400 }
    );
  }
}

export async function DELETE(_request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    const supabase = getSupabaseAdminClient();

    const { count, error: countError } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('artist_id', id);

    if (countError) throw new Error(countError.message);
    if ((count || 0) > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cannot delete artist with existing appointments. Set artist to inactive instead.',
          code: 'ARTIST_HAS_APPOINTMENTS'
        },
        { status: 409 }
      );
    }

    const { error } = await supabase.from('artists').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to delete artist' },
      { status: 400 }
    );
  }
}
