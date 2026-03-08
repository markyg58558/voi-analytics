import { z } from 'zod';
import { DateTime } from 'luxon';
import { getEnv } from '@/lib/config/env';
import { fromCents } from '@/lib/utils/money';
import {
  assertNoArtistOverlap,
  deriveAppointmentTimes,
  findOrCreateClient,
  isBookingPersistenceConfigured,
  validateAppointmentRange
} from '@/lib/services/bookings';
import { getSupabaseAdminClient } from '@/lib/db/supabase-server';

export const APPOINTMENT_SOURCE_VALUES = [
  'walk_in',
  'phone_call',
  'instagram_dm',
  'email_elementor',
  'manual'
];

const appointmentCreateSchema = z.object({
  studioId: z.string().uuid().optional(),
  artistId: z.string().uuid(),
  startAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive(),
  timezone: z.string().min(1),
  source: z.enum(APPOINTMENT_SOURCE_VALUES),
  serviceName: z.string().min(1),
  depositRequiredAmount: z.number().nonnegative(),
  quotedTotalAmount: z.number().nonnegative().optional(),
  designBrief: z.string().max(4000).optional().or(z.literal('')),
  internalNotes: z.string().max(4000).optional().or(z.literal('')),
  clientId: z.string().uuid().optional(),
  client: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phoneE164: z.string().min(8),
      email: z.string().email(),
      smsOptIn: z.boolean().default(true)
    })
    .optional()
})
  .refine((value) => Boolean(value.clientId || value.client), {
    message: 'clientId or client details are required',
    path: ['clientId']
  });

export function normalizeAppointmentCreateRequest(payload) {
  const parsed = appointmentCreateSchema.parse(payload);
  const range = deriveAppointmentTimes({
    startAt: parsed.startAt,
    durationMinutes: parsed.durationMinutes
  });

  validateAppointmentRange(range);
  return { ...parsed, ...range };
}

export function isAppointmentPersistenceConfigured() {
  return isBookingPersistenceConfigured();
}

const appointmentPatchSchema = z
  .object({
    artistId: z.string().uuid().optional(),
    startAt: z.string().datetime({ offset: true }).optional(),
    endAt: z.string().datetime({ offset: true }).optional(),
    status: z.enum(['requested', 'pending_deposit', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show']).optional(),
    source: z.enum(APPOINTMENT_SOURCE_VALUES).optional(),
    depositRequiredAmount: z.number().nonnegative().optional(),
    quotedTotalAmount: z.number().nonnegative().nullable().optional(),
    designBrief: z.string().max(4000).nullable().optional(),
    internalNotes: z.string().max(4000).nullable().optional()
  })
  .refine(
    (value) => {
      const hasStart = typeof value.startAt === 'string';
      const hasEnd = typeof value.endAt === 'string';
      return hasStart === hasEnd;
    },
    {
      message: 'startAt and endAt must be provided together',
      path: ['startAt']
    }
  )
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided'
  });

export function normalizeAppointmentPatchRequest(payload) {
  const parsed = appointmentPatchSchema.parse(payload);
  if (parsed.startAt && parsed.endAt) {
    validateAppointmentRange({ startAt: parsed.startAt, endAt: parsed.endAt });
  }
  return parsed;
}

export async function createAppointmentInSupabase(payload) {
  const env = getEnv();
  const studioId = payload.studioId || env.studioId;

  if (!studioId) {
    throw new Error('Missing studioId (request or NEXT_PUBLIC_STUDIO_ID)');
  }

  await assertNoArtistOverlap({
    artistId: payload.artistId,
    startAt: payload.startAt,
    endAt: payload.endAt
  });

  const supabase = getSupabaseAdminClient();
  let client;
  if (payload.clientId) {
    const { data: existingClient, error: clientLookupError } = await supabase
      .from('clients')
      .select('id,studio_id,first_name,last_name,phone_e164,email,sms_opt_in')
      .eq('id', payload.clientId)
      .eq('studio_id', studioId)
      .maybeSingle();
    if (clientLookupError) throw new Error(`Failed to load selected client: ${clientLookupError.message}`);
    if (!existingClient) throw new Error('Selected client not found for this studio');
    client = existingClient;
  } else {
    client = await findOrCreateClient({
      studioId,
      firstName: payload.client.firstName,
      lastName: payload.client.lastName,
      phoneE164: payload.client.phoneE164,
      email: payload.client.email,
      smsOptIn: payload.client.smsOptIn
    });
  }

  const status = payload.depositRequiredAmount > 0 ? 'pending_deposit' : 'confirmed';

  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      studio_id: studioId,
      client_id: client.id,
      artist_id: payload.artistId,
      status,
      source: payload.source,
      start_at: payload.startAt,
      end_at: payload.endAt,
      timezone: payload.timezone,
      deposit_required_amount: payload.depositRequiredAmount,
      quoted_total_amount: payload.quotedTotalAmount ?? null,
      design_brief: payload.designBrief || null,
      internal_notes: payload.internalNotes || null
    })
    .select(
      'id,studio_id,client_id,artist_id,status,source,start_at,end_at,timezone,deposit_required_amount,deposit_paid_amount,quoted_total_amount,design_brief,internal_notes,deposit_email_sent_at,deposit_link_last_generated_at,reminder_72h_email_sent_at,arrived_at,checked_out_at,paid_in_full_at,created_at'
    )
    .single();

  if (error) {
    throw new Error(`Failed to create appointment: ${error.message}`);
  }

  const { error: serviceLineError } = await supabase.from('appointment_services').insert({
    appointment_id: appointment.id,
    name_snapshot: payload.serviceName,
    duration_minutes: payload.durationMinutes,
    unit_price: payload.quotedTotalAmount ?? null,
    quantity: 1,
    artist_id: payload.artistId
  });

  if (serviceLineError) {
    throw new Error(`Appointment created but service line insert failed: ${serviceLineError.message}`);
  }

  // Create an accounting-friendly order (invoice/receipt header) linked to the appointment.
  // This lets deposits and final checkout payments attach to the same booking.
  const quotedTotal = Number(payload.quotedTotalAmount || 0);
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      studio_id: studioId,
      appointment_id: appointment.id,
      client_id: client.id,
      order_type: 'appointment',
      status: 'open',
      subtotal_amount: quotedTotal,
      tax_amount: 0,
      discount_amount: 0,
      tip_amount: 0,
      total_amount: quotedTotal,
      balance_due_amount: quotedTotal,
      opened_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (orderError) {
    throw new Error(`Appointment created but order insert failed: ${orderError.message}`);
  }

  const { error: orderItemError } = await supabase.from('order_items').insert({
    order_id: order.id,
    service_id: null,
    line_type: 'service',
    description: payload.serviceName,
    quantity: 1,
    unit_price: quotedTotal,
    taxable: false,
    artist_id: payload.artistId
  });

  if (orderItemError) {
    throw new Error(`Appointment created but order item insert failed: ${orderItemError.message}`);
  }

  return { studioId, client, appointment };
}

export async function updateAppointmentInSupabase({ appointmentId, patch }) {
  const supabase = getSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from('appointments')
    .select(
      'id,studio_id,client_id,artist_id,status,source,start_at,end_at,timezone,deposit_required_amount,deposit_paid_amount,quoted_total_amount,design_brief,internal_notes'
    )
    .eq('id', appointmentId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load appointment: ${existingError.message}`);
  }
  if (!existing) {
    const notFoundError = new Error('Appointment not found');
    notFoundError.code = 'NOT_FOUND';
    throw notFoundError;
  }

  const nextArtistId = patch.artistId || existing.artist_id;
  const nextStartAt = patch.startAt || existing.start_at;
  const nextEndAt = patch.endAt || existing.end_at;

  const overlapSensitiveChange =
    nextArtistId !== existing.artist_id || nextStartAt !== existing.start_at || nextEndAt !== existing.end_at;

  if (overlapSensitiveChange) {
    await assertNoArtistOverlap({
      artistId: nextArtistId,
      startAt: nextStartAt,
      endAt: nextEndAt,
      excludeAppointmentId: appointmentId
    });
  }

  const updatePayload = {};
  if (patch.artistId) updatePayload.artist_id = patch.artistId;
  if (patch.startAt) updatePayload.start_at = patch.startAt;
  if (patch.endAt) updatePayload.end_at = patch.endAt;
  if (patch.status) updatePayload.status = patch.status;
  if (patch.source) updatePayload.source = patch.source;
  if (patch.depositRequiredAmount !== undefined) updatePayload.deposit_required_amount = patch.depositRequiredAmount;
  if (patch.quotedTotalAmount !== undefined) updatePayload.quoted_total_amount = patch.quotedTotalAmount;
  if (patch.designBrief !== undefined) updatePayload.design_brief = patch.designBrief;
  if (patch.internalNotes !== undefined) updatePayload.internal_notes = patch.internalNotes;
  if (patch.status === 'checked_in' && existing.status !== 'checked_in') {
    updatePayload.arrived_at = new Date().toISOString();
  }
  if (patch.status === 'completed' && existing.status !== 'completed') {
    updatePayload.checked_out_at = new Date().toISOString();
  }

  const { data: updated, error: updateError } = await supabase
    .from('appointments')
    .update(updatePayload)
    .eq('id', appointmentId)
    .select(
      'id,studio_id,client_id,artist_id,status,source,start_at,end_at,timezone,deposit_required_amount,deposit_paid_amount,quoted_total_amount,design_brief,internal_notes,deposit_email_sent_at,deposit_link_last_generated_at,reminder_72h_email_sent_at,arrived_at,checked_out_at,paid_in_full_at,updated_at'
    )
    .single();

  if (updateError) {
    throw new Error(`Failed to update appointment: ${updateError.message}`);
  }

  return updated;
}

export async function getAppointmentForDepositCheckout(appointmentId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(
      `
      id,
      studio_id,
      client_id,
      artist_id,
      status,
      start_at,
      end_at,
      timezone,
      deposit_required_amount,
      deposit_paid_amount,
      quoted_total_amount,
      deposit_email_sent_at,
      deposit_link_last_generated_at,
      reminder_72h_email_sent_at,
      arrived_at,
      checked_out_at,
      paid_in_full_at,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      artists:artist_id (
        display_name
      ),
      clients:client_id (
        first_name,
        last_name,
        email,
        phone_e164
      )
    `
    )
    .eq('id', appointmentId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load appointment for checkout: ${error.message}`);
  if (!data) {
    const notFoundError = new Error('Appointment not found');
    notFoundError.code = 'NOT_FOUND';
    throw notFoundError;
  }

  const required = Number(data.deposit_required_amount || 0);
  const paid = Number(data.deposit_paid_amount || 0);
  const remaining = Math.max(required - paid, 0);
  return {
    ...data,
    deposit_required_amount: required,
    deposit_paid_amount: paid,
    deposit_remaining_amount: remaining
  };
}

export async function attachCheckoutSessionToAppointment({ appointmentId, sessionId }) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('appointments')
    .update({
      stripe_checkout_session_id: sessionId,
      deposit_link_last_generated_at: new Date().toISOString()
    })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to attach checkout session to appointment: ${error.message}`);
}

export async function markDepositEmailSentOnAppointment({ appointmentId }) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('appointments')
    .update({ deposit_email_sent_at: now })
    .eq('id', appointmentId);

  if (error) throw new Error(`Failed to mark deposit email sent: ${error.message}`);
  return { appointmentId, depositEmailSentAt: now };
}

async function getOrCreateAppointmentOrder({ appointment }) {
  const supabase = getSupabaseAdminClient();
  const { data: existingOrder, error: lookupError } = await supabase
    .from('orders')
    .select('id,studio_id,appointment_id,client_id,status,total_amount,balance_due_amount,opened_at,closed_at')
    .eq('appointment_id', appointment.id)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to lookup appointment order: ${lookupError.message}`);
  }
  if (existingOrder) return existingOrder;

  const quotedTotal = Number(appointment.quoted_total_amount || 0);
  const { data: createdOrder, error: createError } = await supabase
    .from('orders')
    .insert({
      studio_id: appointment.studio_id,
      appointment_id: appointment.id,
      client_id: appointment.client_id,
      order_type: 'appointment',
      status: 'open',
      subtotal_amount: quotedTotal,
      tax_amount: 0,
      discount_amount: 0,
      tip_amount: 0,
      total_amount: quotedTotal,
      balance_due_amount: quotedTotal,
      opened_at: new Date().toISOString()
    })
    .select('id,studio_id,appointment_id,client_id,status,total_amount,balance_due_amount,opened_at,closed_at')
    .single();

  if (createError) {
    throw new Error(`Failed to create appointment order: ${createError.message}`);
  }

  // Backfill an initial service line if there is one.
  const { data: svc } = await supabase
    .from('appointment_services')
    .select('name_snapshot,unit_price,artist_id')
    .eq('appointment_id', appointment.id)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (svc) {
    const { error: itemError } = await supabase.from('order_items').insert({
      order_id: createdOrder.id,
      service_id: null,
      line_type: 'service',
      description: svc.name_snapshot || 'Appointment Service',
      quantity: 1,
      unit_price: Number(svc.unit_price || appointment.quoted_total_amount || 0),
      taxable: false,
      artist_id: svc.artist_id || appointment.artist_id
    });
    if (itemError) {
      throw new Error(`Order created but order item backfill failed: ${itemError.message}`);
    }
  }

  return createdOrder;
}

async function recomputeOrderPaymentState({ orderId }) {
  const supabase = getSupabaseAdminClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,total_amount,tax_amount,discount_amount,tip_amount')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError) throw new Error(`Failed to load order for balance update: ${orderError.message}`);
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('quantity,unit_price,line_total_amount')
    .eq('order_id', orderId);
  if (itemsError) throw new Error(`Failed to load order items: ${itemsError.message}`);

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount,status')
    .eq('order_id', orderId);
  if (paymentsError) throw new Error(`Failed to load order payments: ${paymentsError.message}`);

  const subtotal = (items || []).reduce((sum, item) => {
    if (item.line_total_amount != null) return sum + Number(item.line_total_amount || 0);
    return sum + Number(item.quantity || 0) * Number(item.unit_price || 0);
  }, 0);
  const tax = Number(order.tax_amount || 0);
  const discount = Number(order.discount_amount || 0);
  const tip = Number(order.tip_amount || 0);
  const computedTotal = Math.max(subtotal + tax - discount + tip, 0);
  const amountPaid = (payments || [])
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const total = computedTotal;
  const balanceDue = Math.max(total - amountPaid, 0);
  let status = 'open';
  if (amountPaid > 0 && balanceDue > 0) status = 'partially_paid';
  if (balanceDue <= 0) status = 'paid';

  const patch = {
    subtotal_amount: subtotal,
    total_amount: total,
    status,
    balance_due_amount: balanceDue
  };
  if (status === 'paid') patch.closed_at = new Date().toISOString();

  const { error: updateError } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (updateError) throw new Error(`Failed to update order payment state: ${updateError.message}`);

  return { amountPaid, balanceDue, status, total };
}

function parsePaymentMethodForCheckout(method) {
  const allowed = ['cash', 'stripe_link', 'bank_transfer'];
  if (!allowed.includes(method)) {
    const error = new Error(`Unsupported payment method: ${method}`);
    error.code = 'VALIDATION';
    throw error;
  }
  return method;
}

export async function applyAppointmentManualPriceOverride({ appointmentId, totalAmount, note }) {
  const supabase = getSupabaseAdminClient();
  const appointment = await getAppointmentForDepositCheckout(appointmentId);
  const order = await getOrCreateAppointmentOrder({ appointment });
  const normalizedTotal = Number(totalAmount);
  if (!Number.isFinite(normalizedTotal) || normalizedTotal < 0) {
    const error = new Error('Manual override total must be a valid non-negative number');
    error.code = 'VALIDATION';
    throw error;
  }

  // Update the first service line as the canonical appointment price line.
  const { data: firstItem, error: firstItemError } = await supabase
    .from('order_items')
    .select('id,description,quantity')
    .eq('order_id', order.id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (firstItemError) throw new Error(`Failed to load order item for manual override: ${firstItemError.message}`);

  const quantity = Number(firstItem?.quantity || 1) || 1;
  const unitPrice = quantity > 0 ? Number((normalizedTotal / quantity).toFixed(2)) : normalizedTotal;
  const lineTotalAmount = normalizedTotal;

  if (firstItem?.id) {
    const { error: updateItemError } = await supabase
      .from('order_items')
      .update({
        unit_price: unitPrice,
        line_total_amount: lineTotalAmount,
        notes: note?.trim() || null
      })
      .eq('id', firstItem.id);
    if (updateItemError) throw new Error(`Failed to update order item price override: ${updateItemError.message}`);
  } else {
    const { error: insertItemError } = await supabase.from('order_items').insert({
      order_id: order.id,
      line_type: 'service',
      description: 'Appointment Service',
      quantity: 1,
      unit_price: normalizedTotal,
      line_total_amount: normalizedTotal,
      taxable: false,
      artist_id: appointment.artist_id,
      notes: note?.trim() || null
    });
    if (insertItemError) throw new Error(`Failed to insert order item price override: ${insertItemError.message}`);
  }

  // Keep appointment quoted total aligned for calendar and quoting workflows.
  const { error: apptUpdateError } = await supabase
    .from('appointments')
    .update({ quoted_total_amount: normalizedTotal })
    .eq('id', appointmentId);
  if (apptUpdateError) throw new Error(`Failed to sync appointment quoted total: ${apptUpdateError.message}`);

  if (note?.trim()) {
    const stamp = DateTime.now().setZone(appointment.timezone || 'Australia/Melbourne').toFormat('yyyy-LL-dd HH:mm');
    const existingNotes = appointment.internal_notes || '';
    const nextNotes = [existingNotes, `[${stamp}] Manual price override: ${note.trim()}`].filter(Boolean).join('\n');
    const { error: noteError } = await supabase
      .from('appointments')
      .update({ internal_notes: nextNotes })
      .eq('id', appointmentId);
    if (noteError) throw new Error(`Failed to append override note: ${noteError.message}`);
  }

  await recomputeOrderPaymentState({ orderId: order.id });
  return getAppointmentOrderSummary({ appointmentId });
}

export async function addAppointmentCheckoutPayment({ appointmentId, amount, method }) {
  const supabase = getSupabaseAdminClient();
  const appointment = await getAppointmentForDepositCheckout(appointmentId);
  const order = await getOrCreateAppointmentOrder({ appointment });
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    const error = new Error('Payment amount must be greater than 0');
    error.code = 'VALIDATION';
    throw error;
  }
  const paymentMethod = parsePaymentMethodForCheckout(method);

  const { error: insertError } = await supabase.from('payments').insert({
    studio_id: appointment.studio_id,
    order_id: order.id,
    appointment_id: appointment.id,
    payment_type: 'final',
    method: paymentMethod,
    status: 'succeeded',
    amount: normalizedAmount,
    currency: String(getEnv().studioCurrency || 'AUD').toUpperCase(),
    paid_at: new Date().toISOString()
  });
  if (insertError) throw new Error(`Failed to record payment: ${insertError.message}`);

  const orderState = await recomputeOrderPaymentState({ orderId: order.id });
  if (orderState && orderState.balanceDue <= 0) {
    const { error: paidError } = await supabase
      .from('appointments')
      .update({ paid_in_full_at: new Date().toISOString() })
      .eq('id', appointment.id);
    if (paidError) throw new Error(`Failed to mark appointment paid in full: ${paidError.message}`);
  }

  return getAppointmentOrderSummary({ appointmentId });
}

export async function completeAppointmentCheckout({ appointmentId }) {
  const supabase = getSupabaseAdminClient();
  const summary = await getAppointmentOrderSummary({ appointmentId });
  const now = new Date().toISOString();
  const isFullyPaid = Number(summary.order.balanceDueAmount || 0) <= 0;

  const apptPatch = {
    status: 'completed',
    checked_out_at: now
  };
  if (isFullyPaid) apptPatch.paid_in_full_at = now;

  const { error: apptError } = await supabase.from('appointments').update(apptPatch).eq('id', appointmentId);
  if (apptError) throw new Error(`Failed to complete appointment checkout: ${apptError.message}`);

  const orderPatch = isFullyPaid
    ? { status: 'paid', closed_at: now, balance_due_amount: 0 }
    : { status: 'partially_paid' };
  const { error: orderError } = await supabase.from('orders').update(orderPatch).eq('id', summary.order.id);
  if (orderError) throw new Error(`Failed to finalize order at checkout: ${orderError.message}`);

  return getAppointmentOrderSummary({ appointmentId });
}

export async function getAppointmentOrderSummary({ appointmentId }) {
  const supabase = getSupabaseAdminClient();

  const appointment = await getAppointmentForDepositCheckout(appointmentId);
  const order = await getOrCreateAppointmentOrder({ appointment });

  const [{ data: items, error: itemsError }, { data: payments, error: paymentsError }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id,order_id,line_type,description,quantity,unit_price,line_total_amount,taxable,artist_id,sort_order,notes')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('payments')
      .select('id,order_id,appointment_id,payment_type,method,status,amount,currency,paid_at,created_at,stripe_checkout_session_id')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })
  ]);

  if (itemsError) throw new Error(`Failed to load order items: ${itemsError.message}`);
  if (paymentsError) throw new Error(`Failed to load order payments: ${paymentsError.message}`);

  const amountPaid = (payments || [])
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalAmount = Number(order.total_amount || 0);
  const balanceDue = Math.max(totalAmount - amountPaid, 0);

  return {
    appointment: {
      id: appointment.id,
      status: appointment.status,
      startAt: appointment.start_at,
      endAt: appointment.end_at,
      timezone: appointment.timezone,
      depositRequiredAmount: Number(appointment.deposit_required_amount || 0),
      depositPaidAmount: Number(appointment.deposit_paid_amount || 0),
      quotedTotalAmount: appointment.quoted_total_amount == null ? null : Number(appointment.quoted_total_amount),
      depositLinkLastGeneratedAt: appointment.deposit_link_last_generated_at || null,
      depositEmailSentAt: appointment.deposit_email_sent_at || null,
      reminder72hEmailSentAt: appointment.reminder_72h_email_sent_at || null,
      arrivedAt: appointment.arrived_at || null,
      checkedOutAt: appointment.checked_out_at || null,
      paidInFullAt: appointment.paid_in_full_at || null
    },
    order: {
      id: order.id,
      status: order.status,
      totalAmount,
      balanceDueAmount: Number(order.balance_due_amount || balanceDue),
      amountPaid,
      openedAt: order.opened_at || null,
      closedAt: order.closed_at || null
    },
    items: (items || []).map((item) => ({
      id: item.id,
      lineType: item.line_type,
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unit_price || 0),
      lineTotalAmount:
        item.line_total_amount == null
          ? Number(item.quantity || 0) * Number(item.unit_price || 0)
          : Number(item.line_total_amount),
      taxable: Boolean(item.taxable),
      artistId: item.artist_id || null,
      sortOrder: Number(item.sort_order || 0),
      notes: item.notes || null
    })),
    payments: (payments || []).map((payment) => ({
      id: payment.id,
      paymentType: payment.payment_type,
      method: payment.method,
      status: payment.status,
      amount: Number(payment.amount || 0),
      currency: payment.currency,
      paidAt: payment.paid_at || null,
      createdAt: payment.created_at || null,
      stripeCheckoutSessionId: payment.stripe_checkout_session_id || null
    }))
  };
}

async function insertWebhookEventIfNew({ provider, providerEventId, eventType, payload, studioId }) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('webhook_events')
    .insert({
      studio_id: studioId || null,
      provider,
      provider_event_id: providerEventId,
      event_type: eventType,
      payload,
      status: 'received'
    })
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return { duplicate: true, id: null };
    throw new Error(`Failed to record webhook event: ${error.message}`);
  }

  return { duplicate: false, id: data?.id || null };
}

async function markWebhookEventProcessed({ provider, providerEventId, errorMessage }) {
  const supabase = getSupabaseAdminClient();
  const patch = errorMessage
    ? { status: 'failed', error: errorMessage }
    : { status: 'processed', processed_at: new Date().toISOString() };
  await supabase.from('webhook_events').update(patch).eq('provider', provider).eq('provider_event_id', providerEventId);
}

export async function processStripeCheckoutCompleted({ eventId, session }) {
  const appointmentId = session?.metadata?.appointmentId;
  if (!appointmentId) {
    return { ok: false, skipped: true, reason: 'Missing appointmentId metadata' };
  }

  const amountPaid = fromCents(session.amount_total || 0);
  const currency = String(session.currency || 'aud').toUpperCase();
  const checkoutPaymentType = session?.metadata?.paymentType === 'final' ? 'final' : 'deposit';
  const metadataOrderId =
    typeof session?.metadata?.orderId === 'string' && session.metadata.orderId ? session.metadata.orderId : null;

  const existing = await getAppointmentForDepositCheckout(appointmentId);
  const webhookRecord = await insertWebhookEventIfNew({
    provider: 'stripe',
    providerEventId: eventId,
    eventType: 'checkout.session.completed',
    payload: session,
    studioId: existing.studio_id
  });

  if (webhookRecord.duplicate) {
    return { ok: true, duplicate: true, appointmentId };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const fallbackOrder = await getOrCreateAppointmentOrder({ appointment: existing });
    const order = metadataOrderId ? { id: metadataOrderId } : fallbackOrder;

    let appointmentPatch = {
      stripe_checkout_session_id: session.id || existing.stripe_checkout_session_id || null,
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string' ? session.payment_intent : existing.stripe_payment_intent_id || null
    };

    if (checkoutPaymentType === 'deposit') {
      const nextDepositPaid = Math.max(existing.deposit_paid_amount, amountPaid);
      const shouldConfirm = nextDepositPaid >= existing.deposit_required_amount;
      const nextStatus =
        shouldConfirm && ['pending_deposit', 'requested'].includes(existing.status) ? 'confirmed' : existing.status;
      appointmentPatch = {
        ...appointmentPatch,
        deposit_paid_amount: nextDepositPaid,
        status: nextStatus
      };
    }

    const { error: apptError } = await supabase
      .from('appointments')
      .update(appointmentPatch)
      .eq('id', appointmentId);

    if (apptError) throw new Error(`Failed to update appointment deposit state: ${apptError.message}`);

    const { data: existingPayment, error: paymentLookupError } = await supabase
      .from('payments')
      .select('id,status')
      .eq('appointment_id', appointmentId)
      .eq('stripe_checkout_session_id', session.id || '')
      .limit(1)
      .maybeSingle();

    if (paymentLookupError) throw new Error(`Failed to lookup payment record: ${paymentLookupError.message}`);

    if (!existingPayment) {
      const { error: paymentInsertError } = await supabase.from('payments').insert({
        studio_id: existing.studio_id,
        order_id: order?.id || null,
        appointment_id: appointmentId,
        payment_type: checkoutPaymentType,
        method: 'stripe_link',
        status: 'succeeded',
        amount: amountPaid,
        currency,
        stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        stripe_checkout_session_id: session.id || null,
        paid_at: new Date().toISOString()
      });

      if (paymentInsertError) throw new Error(`Failed to insert payment record: ${paymentInsertError.message}`);
    }

    const orderState = order?.id ? await recomputeOrderPaymentState({ orderId: order.id }) : null;
    if (orderState && orderState.balanceDue <= 0) {
      const { error: paidInFullError } = await supabase
        .from('appointments')
        .update({ paid_in_full_at: new Date().toISOString() })
        .eq('id', appointmentId);
      if (paidInFullError) throw new Error(`Failed to set appointment paid_in_full_at: ${paidInFullError.message}`);
    }

    await markWebhookEventProcessed({ provider: 'stripe', providerEventId: eventId });
    return { ok: true, appointmentId, amountPaid };
  } catch (error) {
    await markWebhookEventProcessed({
      provider: 'stripe',
      providerEventId: eventId,
      errorMessage: error instanceof Error ? error.message : 'Stripe webhook processing failed'
    });
    throw error;
  }
}
