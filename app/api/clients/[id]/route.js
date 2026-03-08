import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const paramsSchema = z.object({
  id: z.string().uuid()
});

const patchClientSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phoneE164: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
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
  if (!value) return null;
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

export async function PATCH(request, context) {
  try {
    const { id } = paramsSchema.parse(context.params || {});
    const input = patchClientSchema.parse(await request.json());

    const patch = {};
    if (input.firstName !== undefined) patch.first_name = input.firstName.trim();
    if (input.lastName !== undefined) patch.last_name = input.lastName.trim();
    if (input.phoneE164 !== undefined) patch.phone_e164 = normalizeAustralianPhoneToE164(input.phoneE164);
    if (input.email !== undefined) patch.email = input.email?.trim().toLowerCase() || null;
    if (input.instagramHandle !== undefined) patch.instagram_handle = input.instagramHandle?.trim() || null;
    if (input.status !== undefined) patch.status = input.status;
    if (input.clientType !== undefined) patch.client_type = input.clientType;
    if (input.source !== undefined) patch.source = input.source?.trim() || null;
    if (input.marketingOptIn !== undefined) patch.marketing_opt_in = input.marketingOptIn;
    if (input.smsOptIn !== undefined) patch.sms_opt_in = input.smsOptIn;
    if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ ok: false, error: 'No changes provided' }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('id', id)
      .select(
        'id,studio_id,first_name,last_name,phone_e164,email,instagram_handle,status,client_type,source,marketing_opt_in,sms_opt_in,notes,created_at,updated_at'
      )
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, client: mapClient(data) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to update client' },
      { status: 400 }
    );
  }
}
