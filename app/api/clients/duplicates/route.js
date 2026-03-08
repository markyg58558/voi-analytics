import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const querySchema = z.object({
  studioId: z.string().uuid().optional(),
  excludeId: z.string().uuid().optional(),
  phoneE164: z.string().max(30).optional(),
  email: z.string().email().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10)
});

function normalizeAustralianPhoneToE164(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (/^0\d{9}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^61\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9,15}$/.test(digits)) return `+${digits}`;
  return value;
}

function mapClient(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneE164: row.phone_e164 || null,
    email: row.email || null,
    status: row.status || 'active',
    clientType: row.client_type || 'new'
  };
}

export async function GET(request) {
  try {
    const parsed = querySchema.parse({
      studioId: request.nextUrl.searchParams.get('studioId') || undefined,
      excludeId: request.nextUrl.searchParams.get('excludeId') || undefined,
      phoneE164: request.nextUrl.searchParams.get('phoneE164') || undefined,
      email: request.nextUrl.searchParams.get('email') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || undefined
    });

    const env = getEnv();
    const studioId = parsed.studioId || env.studioId;
    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const phone = parsed.phoneE164 ? normalizeAustralianPhoneToE164(parsed.phoneE164) : '';
    const email = parsed.email ? parsed.email.trim().toLowerCase() : '';
    if (!phone && !email) {
      return NextResponse.json({ ok: true, duplicates: [] });
    }

    const orParts = [];
    if (phone) orParts.push(`phone_e164.eq.${phone}`);
    if (email) orParts.push(`email.eq.${email}`);

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('clients')
      .select('id,first_name,last_name,phone_e164,email,status,client_type')
      .eq('studio_id', studioId)
      .or(orParts.join(','))
      .limit(parsed.limit);

    if (parsed.excludeId) {
      query = query.neq('id', parsed.excludeId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const duplicates = (data || []).map((row) => ({
      ...mapClient(row),
      duplicateReasons: [
        ...(phone && row.phone_e164 === phone ? ['phone'] : []),
        ...(email && String(row.email || '').toLowerCase() === email ? ['email'] : [])
      ]
    }));

    return NextResponse.json({ ok: true, duplicates, checked: { phone: phone || null, email: email || null } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to check duplicates' },
      { status: 400 }
    );
  }
}
