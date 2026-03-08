import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const createServiceSchema = z.object({
  studioId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  basePrice: z.coerce.number().min(0).optional().nullable(),
  taxable: z.boolean().optional(),
  active: z.boolean().optional()
});

function mapServiceRow(row, pricingByServiceId = new Map()) {
  const pricingRows = pricingByServiceId.get(row.id) || [];
  return {
    id: row.id,
    studioId: row.studio_id,
    name: row.name,
    category: row.category,
    durationMinutes: row.duration_minutes,
    basePrice: row.base_price == null ? null : Number(row.base_price),
    taxable: Boolean(row.taxable),
    active: Boolean(row.active),
    artistPricing: pricingRows.map((p) => ({
      id: p.id,
      serviceId: p.service_id,
      artistId: p.artist_id,
      priceAmount: p.price_amount == null ? null : Number(p.price_amount),
      durationMinutes: p.duration_minutes == null ? null : Number(p.duration_minutes),
      active: Boolean(p.active)
    }))
  };
}

export async function GET(request) {
  try {
    const env = getEnv();
    const studioId = request.nextUrl.searchParams.get('studioId') || env.studioId;
    const includeInactive = ['1', 'true', 'yes'].includes(
      String(request.nextUrl.searchParams.get('includeInactive') || '').toLowerCase()
    );
    const artistId = request.nextUrl.searchParams.get('artistId') || '';
    const includeAllPricing = ['1', 'true', 'yes'].includes(
      String(request.nextUrl.searchParams.get('includeAllPricing') || '').toLowerCase()
    );

    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('service_catalog')
      .select('id,studio_id,name,category,duration_minutes,base_price,taxable,active')
      .eq('studio_id', studioId)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (!includeInactive) query = query.eq('active', true);

    const { data: services, error } = await query;
    if (error) throw new Error(error.message);

    const serviceRows = services || [];
    const serviceIds = serviceRows.map((s) => s.id);
    let pricingRows = [];

    if (serviceIds.length) {
      let pricingQuery = supabase
        .from('artist_service_pricing')
        .select('id,studio_id,artist_id,service_id,price_amount,duration_minutes,active')
        .eq('studio_id', studioId)
        .in('service_id', serviceIds);

      if (artistId && !includeAllPricing) {
        pricingQuery = pricingQuery.eq('artist_id', artistId);
      }
      if (!includeInactive) {
        pricingQuery = pricingQuery.eq('active', true);
      }

      const { data: pricing, error: pricingError } = await pricingQuery;
      if (pricingError) {
        // If the new table migration hasn't been applied yet, degrade gracefully.
        if (pricingError.code !== '42P01') throw new Error(pricingError.message);
      } else {
        pricingRows = pricing || [];
      }
    }

    const pricingByServiceId = pricingRows.reduce((map, row) => {
      const arr = map.get(row.service_id) || [];
      arr.push(row);
      map.set(row.service_id, arr);
      return map;
    }, new Map());

    return NextResponse.json({
      ok: true,
      services: serviceRows.map((row) => mapServiceRow(row, pricingByServiceId))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load services' },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  try {
    const env = getEnv();
    const body = await request.json();
    const input = createServiceSchema.parse(body);
    const studioId = input.studioId || env.studioId;

    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('service_catalog')
      .insert({
        studio_id: studioId,
        name: input.name.trim(),
        category: input.category.trim(),
        duration_minutes: input.durationMinutes,
        base_price: input.basePrice ?? null,
        taxable: input.taxable ?? false,
        active: input.active ?? true
      })
      .select('id,studio_id,name,category,duration_minutes,base_price,taxable,active')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, service: mapServiceRow(data) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create service' },
      { status: 400 }
    );
  }
}
