import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const listQuerySchema = z.object({
  studioId: z.string().uuid().optional(),
  q: z.string().optional(),
  status: z.string().optional(),
  clientType: z.string().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50)
});

const createClientSchema = z.object({
  studioId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phoneE164: z.string().max(30),
  email: z.string().email(),
  instagramHandle: z.string().max(120).optional().or(z.literal('')),
  status: z.enum(['active', 'vip', 'do_not_book', 'archived']).optional(),
  clientType: z.enum(['new', 'rebooked', 'lapsed']).optional(),
  source: z.string().max(80).optional().or(z.literal('')),
  marketingOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  notes: z.string().max(5000).optional().or(z.literal(''))
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
    studioId: row.studio_id,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneE164: row.phone_e164 || null,
    email: row.email || null,
    instagramHandle: row.instagram_handle || null,
    status: row.status || 'active',
    clientType: row.client_type || 'new',
    source: row.source || null,
    marketingOptIn: Boolean(row.marketing_opt_in),
    smsOptIn: Boolean(row.sms_opt_in),
    notes: row.notes || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null
  };
}

export async function GET(request) {
  try {
    const queryInput = listQuerySchema.parse({
      studioId: request.nextUrl.searchParams.get('studioId') || undefined,
      q: request.nextUrl.searchParams.get('q') || undefined,
      status: request.nextUrl.searchParams.get('status') || undefined,
      clientType: request.nextUrl.searchParams.get('clientType') || undefined,
      includeArchived: request.nextUrl.searchParams.get('includeArchived') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || undefined
    });

    const env = getEnv();
    const studioId = queryInput.studioId || env.studioId;
    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('clients')
      .select(
        'id,studio_id,first_name,last_name,phone_e164,email,instagram_handle,status,client_type,source,marketing_opt_in,sms_opt_in,notes,created_at,updated_at'
      )
      .eq('studio_id', studioId)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .limit(queryInput.limit);

    if (!queryInput.includeArchived) {
      query = query.neq('status', 'archived');
    }
    if (queryInput.status) {
      query = query.eq('status', queryInput.status);
    }
    if (queryInput.clientType) {
      query = query.eq('client_type', queryInput.clientType);
    }
    if (queryInput.q?.trim()) {
      const q = queryInput.q.trim();
      if (/[0-9]{4,}/.test(q)) {
        const normalized = q.replace(/\s+/g, '');
        query = query.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone_e164.ilike.%${normalized}%`
        );
      } else {
        query = query.or(
          `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,instagram_handle.ilike.%${q}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, clients: (data || []).map(mapClient) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load clients' },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  try {
    const env = getEnv();
    const body = await request.json();
    const input = createClientSchema.parse(body);
    const studioId = input.studioId || env.studioId;
    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const payload = {
      studio_id: studioId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone_e164: normalizeAustralianPhoneToE164(input.phoneE164),
      email: input.email.trim().toLowerCase(),
      instagram_handle: input.instagramHandle?.trim() || null,
      status: input.status || 'active',
      client_type: input.clientType || 'new',
      source: input.source?.trim() || 'manual',
      marketing_opt_in: input.marketingOptIn ?? false,
      sms_opt_in: input.smsOptIn ?? true,
      notes: input.notes?.trim() || null
    };

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('clients')
      .insert(payload)
      .select(
        'id,studio_id,first_name,last_name,phone_e164,email,instagram_handle,status,client_type,source,marketing_opt_in,sms_opt_in,notes,created_at,updated_at'
      )
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, client: mapClient(data) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to create client' },
      { status: 400 }
    );
  }
}
