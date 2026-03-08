import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const paramsSchema = z.object({
  id: z.string().uuid()
});

const patchServiceSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(80).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  basePrice: z.coerce.number().min(0).optional().nullable(),
  taxable: z.boolean().optional(),
  active: z.boolean().optional()
});

export async function PATCH(request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    const body = await request.json();
    const input = patchServiceSchema.parse(body);

    const patch = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.category !== undefined) patch.category = input.category.trim();
    if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
    if (input.basePrice !== undefined) patch.base_price = input.basePrice;
    if (input.taxable !== undefined) patch.taxable = input.taxable;
    if (input.active !== undefined) patch.active = input.active;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: 'No changes provided' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('service_catalog')
      .update(patch)
      .eq('id', id)
      .select('id,studio_id,name,category,duration_minutes,base_price,taxable,active')
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      service: {
        id: data.id,
        studioId: data.studio_id,
        name: data.name,
        category: data.category,
        durationMinutes: data.duration_minutes,
        basePrice: data.base_price == null ? null : Number(data.base_price),
        taxable: Boolean(data.taxable),
        active: Boolean(data.active)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update service' },
      { status: 400 }
    );
  }
}
