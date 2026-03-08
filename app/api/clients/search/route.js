import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv } from '@/lib/config/env';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

const querySchema = z.object({
  q: z.string().min(1),
  studioId: z.string().uuid().optional()
});

function looksLikePhone(input) {
  return /[0-9]{4,}/.test(input || '');
}

export async function GET(request) {
  try {
    const parsed = querySchema.parse({
      q: request.nextUrl.searchParams.get('q') || '',
      studioId: request.nextUrl.searchParams.get('studioId') || undefined
    });

    const env = getEnv();
    const studioId = parsed.studioId || env.studioId;
    if (!studioId) {
      return NextResponse.json({ ok: false, error: 'Missing studioId' }, { status: 400 });
    }

    const q = parsed.q.trim();
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from('clients')
      .select('id,studio_id,first_name,last_name,phone_e164,email,sms_opt_in,marketing_opt_in,created_at')
      .eq('studio_id', studioId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (looksLikePhone(q)) {
      const normalized = q.replace(/\s+/g, '');
      query = query.or(`phone_e164.ilike.%${normalized}%,email.ilike.%${q}%`);
    } else if (q.includes('@')) {
      query = query.ilike('email', `%${q}%`);
    } else {
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      clients: (data || []).map((client) => ({
        id: client.id,
        studioId: client.studio_id,
        firstName: client.first_name,
        lastName: client.last_name,
        phoneE164: client.phone_e164,
        email: client.email,
        smsOptIn: client.sms_opt_in,
        marketingOptIn: client.marketing_opt_in
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to search clients' },
      { status: 400 }
    );
  }
}
