import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const paramsSchema = z.object({
  id: z.string().uuid()
});

const upsertPricingSchema = z.object({
  studioId: z.string().uuid().optional(),
  artistId: z.string().uuid(),
  priceAmount: z.coerce.number().min(0).optional().nullable(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).optional().nullable(),
  active: z.boolean().optional()
});

export async function PUT(request, context) {
  try {
    const { id: serviceId } = paramsSchema.parse(context.params || {});
    const body = await request.json();
    const input = upsertPricingSchema.parse(body);
    const env = getEnv();
    const studioId = input.studioId || env.studioId;

    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const payload = {
      studio_id: studioId,
      artist_id: input.artistId,
      service_id: serviceId,
      price_amount: input.priceAmount ?? null,
      duration_minutes: input.durationMinutes ?? null,
      active: input.active ?? true
    };

    const { data, error } = await supabase
      .from('artist_service_pricing')
      .upsert(payload, { onConflict: 'artist_id,service_id' })
      .select('id,studio_id,artist_id,service_id,price_amount,duration_minutes,active')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      pricing: {
        id: data.id,
        studioId: data.studio_id,
        artistId: data.artist_id,
        serviceId: data.service_id,
        priceAmount: data.price_amount == null ? null : Number(data.price_amount),
        durationMinutes: data.duration_minutes == null ? null : Number(data.duration_minutes),
        active: Boolean(data.active)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to save artist pricing' },
      { status: 400 }
    );
  }
}
