'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const CLIENT_STATUS_OPTIONS = ['active', 'vip', 'do_not_book', 'archived'];
const CLIENT_TYPE_OPTIONS = ['new', 'rebooked', 'lapsed'];
const CLIENT_SOURCE_OPTIONS = ['manual', 'phone_call', 'walk_in', 'instagram_dm', 'email_elementor', 'referral'];

function emptyClientForm() {
  return {
    firstName: '',
    lastName: '',
    phoneE164: '',
    email: '',
    instagramHandle: '',
    status: 'active',
    clientType: 'new',
    source: 'manual',
    marketingOptIn: false,
    smsOptIn: true,
    notes: ''
  };
}

function normalizeAustralianPhoneForReception(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (/^0\d{9}$/.test(digits)) return `+61${digits.slice(1)}`;
  if (/^61\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\d{9,15}$/.test(digits)) return `+${digits}`;
  return value;
}

function formFromClient(client) {
  return {
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    phoneE164: client.phoneE164 || '',
    email: client.email || '',
    instagramHandle: client.instagramHandle || '',
    status: client.status || 'active',
    clientType: client.clientType || 'new',
    source: client.source || 'manual',
    marketingOptIn: Boolean(client.marketingOptIn),
    smsOptIn: Boolean(client.smsOptIn),
    notes: client.notes || ''
  };
}

function normalizePayload(form) {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    phoneE164: normalizeAustralianPhoneForReception(form.phoneE164),
    email: form.email.trim(),
    instagramHandle: form.instagramHandle.trim(),
    status: form.status,
    clientType: form.clientType,
    source: form.source,
    marketingOptIn: Boolean(form.marketingOptIn),
    smsOptIn: Boolean(form.smsOptIn),
    notes: form.notes.trim()
  };
}

function DuplicateWarningBox({ duplicateState }) {
  if (!duplicateState) return null;
  if (duplicateState.loading) {
    return <div style={{ gridColumn: '1 / -1', fontSize: 12, opacity: 0.7 }}>Checking for duplicates...</div>;
  }
  if (!duplicateState.matches?.length) return null;

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        border: '1px solid rgba(255,177,66,0.45)',
        background: 'rgba(255,177,66,0.08)',
        borderRadius: 10,
        padding: '0.65rem 0.75rem'
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#ffd28a' }}>
        Possible duplicate client{duplicateState.matches.length > 1 ? 's' : ''} found
      </p>
      <p style={{ margin: '0.25rem 0 0.5rem', fontSize: 12, opacity: 0.85 }}>
        You can still save, but check these first to avoid duplicates.
      </p>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        {duplicateState.matches.map((client) => (
          <div
            key={client.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.65rem',
              padding: '0.45rem 0.55rem',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.18)'
            }}
          >
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 700 }}>{[client.firstName, client.lastName].filter(Boolean).join(' ') || 'Client'}</div>
              <div style={{ opacity: 0.85 }}>{client.phoneE164 || '—'} | {client.email || '—'}</div>
              <div style={{ opacity: 0.75 }}>
                Match: {(client.duplicateReasons || []).join(', ')} • {client.status || 'active'} • {client.clientType || 'new'}
              </div>
            </div>
            <Link
              href={`/clients/${client.id}`}
              style={{
                border: '1px solid #333',
                borderRadius: 999,
                padding: '0.2rem 0.55rem',
                textDecoration: 'none',
                color: 'inherit',
                fontSize: 12,
                whiteSpace: 'nowrap'
              }}
            >
              Open
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientForm({ value, onChange, onSubmit, submitting, submitLabel, onCancel, duplicateState }) {
  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}
    >
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>First Name</span>
        <input value={value.firstName} onChange={(e) => onChange((p) => ({ ...p, firstName: e.target.value }))} required style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
      </label>
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Last Name</span>
        <input value={value.lastName} onChange={(e) => onChange((p) => ({ ...p, lastName: e.target.value }))} required style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
      </label>
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Phone</span>
        <input
          value={value.phoneE164}
          onChange={(e) => onChange((p) => ({ ...p, phoneE164: e.target.value }))}
          onBlur={(e) => onChange((p) => ({ ...p, phoneE164: normalizeAustralianPhoneForReception(e.target.value) }))}
          placeholder="0418731287"
          required
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Email</span>
        <input type="email" value={value.email} onChange={(e) => onChange((p) => ({ ...p, email: e.target.value }))} required style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
      </label>
      <DuplicateWarningBox duplicateState={duplicateState} />
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Instagram Handle</span>
        <input value={value.instagramHandle} onChange={(e) => onChange((p) => ({ ...p, instagramHandle: e.target.value }))} placeholder="@client" style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
      </label>
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Status</span>
        <select value={value.status} onChange={(e) => onChange((p) => ({ ...p, status: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
          {CLIENT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Client Type</span>
        <select value={value.clientType} onChange={(e) => onChange((p) => ({ ...p, clientType: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
          {CLIENT_TYPE_OPTIONS.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Source</span>
        <select value={value.source} onChange={(e) => onChange((p) => ({ ...p, source: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
          {CLIENT_SOURCE_OPTIONS.map((source) => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
        <input type="checkbox" checked={value.smsOptIn} onChange={(e) => onChange((p) => ({ ...p, smsOptIn: e.target.checked }))} />
        <span style={{ fontSize: 13 }}>SMS Opt In</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
        <input type="checkbox" checked={value.marketingOptIn} onChange={(e) => onChange((p) => ({ ...p, marketingOptIn: e.target.checked }))} />
        <span style={{ fontSize: 13 }}>Marketing Opt In</span>
      </label>
      <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Notes</span>
        <textarea rows={3} value={value.notes} onChange={(e) => onChange((p) => ({ ...p, notes: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
      </label>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.55rem', justifyContent: 'flex-end' }}>
        {onCancel ? <button type="button" onClick={onCancel} style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.8rem', cursor: 'pointer' }}>Cancel</button> : null}
        <button type="submit" disabled={submitting} style={{ border: '1px solid #2ec4b6', background: 'rgba(46,196,182,0.1)', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.8rem', cursor: submitting ? 'progress' : 'pointer' }}>
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function ClientAdminPanel() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientTypeFilter, setClientTypeFilter] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [createForm, setCreateForm] = useState(emptyClientForm());
  const [createSaving, setCreateSaving] = useState(false);
  const [createDuplicateState, setCreateDuplicateState] = useState({ loading: false, matches: [] });
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editDuplicateState, setEditDuplicateState] = useState({ loading: false, matches: [] });

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const phone = normalizeAustralianPhoneForReception(createForm.phoneE164);
    const email = createForm.email.trim().toLowerCase();
    if (!phone && !email) {
      setCreateDuplicateState({ loading: false, matches: [] });
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setCreateDuplicateState((prev) => ({ ...prev, loading: true }));
      try {
        const params = new URLSearchParams();
        if (phone) params.set('phoneE164', phone);
        if (email) params.set('email', email);
        const res = await fetch(`/api/clients/duplicates?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || `Duplicate check failed (${res.status})`);
        if (!cancelled) setCreateDuplicateState({ loading: false, matches: data.duplicates || [] });
      } catch {
        if (!cancelled) setCreateDuplicateState({ loading: false, matches: [] });
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [createForm.phoneE164, createForm.email]);

  useEffect(() => {
    let cancelled = false;
    if (!editingId || !editForm) {
      setEditDuplicateState({ loading: false, matches: [] });
      return undefined;
    }
    const phone = normalizeAustralianPhoneForReception(editForm.phoneE164);
    const email = editForm.email.trim().toLowerCase();
    if (!phone && !email) {
      setEditDuplicateState({ loading: false, matches: [] });
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setEditDuplicateState((prev) => ({ ...prev, loading: true }));
      try {
        const params = new URLSearchParams({ excludeId: editingId });
        if (phone) params.set('phoneE164', phone);
        if (email) params.set('email', email);
        const res = await fetch(`/api/clients/duplicates?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || `Duplicate check failed (${res.status})`);
        if (!cancelled) setEditDuplicateState({ loading: false, matches: data.duplicates || [] });
      } catch {
        if (!cancelled) setEditDuplicateState({ loading: false, matches: [] });
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [editingId, editForm?.phoneE164, editForm?.email]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ includeArchived: String(includeArchived), limit: '200' });
        if (query.trim()) params.set('q', query.trim());
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (clientTypeFilter !== 'all') params.set('clientType', clientTypeFilter);
        const res = await fetch(`/api/clients?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to load clients (${res.status})`);
        if (!cancelled) setClients(data.clients || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load clients');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [clientTypeFilter, includeArchived, query, statusFilter]);

  const counts = useMemo(() => {
    return clients.reduce((acc, client) => {
      acc.total += 1;
      acc[client.status] = (acc[client.status] || 0) + 1;
      acc[`type_${client.clientType || 'new'}`] = (acc[`type_${client.clientType || 'new'}`] || 0) + 1;
      return acc;
    }, { total: 0 });
  }, [clients]);

  async function createClient(e) {
    e.preventDefault();
    if (createDuplicateState.matches?.length) {
      const proceed = window.confirm(
        `Possible duplicate client(s) found by phone/email. Save anyway and create a new client record?`
      );
      if (!proceed) return;
    }
    setCreateSaving(true);
    setError('');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizePayload(createForm))
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to create client (${res.status})`);
      setClients((prev) => [...prev, data.client]);
      setCreateForm(emptyClientForm());
      setToast(`Added ${data.client.firstName} ${data.client.lastName}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create client');
    } finally {
      setCreateSaving(false);
    }
  }

  async function saveClientEdit(e) {
    e.preventDefault();
    if (!editingId || !editForm) return;
    if (editDuplicateState.matches?.length) {
      const proceed = window.confirm(
        `Possible duplicate client(s) found by phone/email. Save changes anyway?`
      );
      if (!proceed) return;
    }
    setEditSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/clients/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizePayload(editForm))
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to update client (${res.status})`);
      setClients((prev) => prev.map((c) => (c.id === editingId ? data.client : c)));
      setToast(`Saved ${data.client.firstName} ${data.client.lastName}`);
      setEditingId('');
      setEditForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update client');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 16 }}>Add Client</h3>
        <ClientForm
          value={createForm}
          onChange={setCreateForm}
          onSubmit={createClient}
          submitting={createSaving}
          submitLabel="Add Client"
          duplicateState={createDuplicateState}
        />
      </section>

      <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Clients</h3>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.75, fontSize: 13 }}>
              {counts.total || 0} loaded • New: {counts.type_new || 0} • Rebooked: {counts.type_rebooked || 0} • Lapsed: {counts.type_lapsed || 0}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, email, Instagram..."
              style={{ minWidth: 260, padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
              <option value="all">all statuses</option>
              {CLIENT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <select value={clientTypeFilter} onChange={(e) => setClientTypeFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
              <option value="all">all client types</option>
              {CLIENT_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: 13 }}>
              <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
              Include archived
            </label>
          </div>
        </div>

        {toast ? <p style={{ margin: '0 0 0.5rem', color: '#9de6c1' }}>{toast}</p> : null}
        {error ? <p style={{ margin: '0 0 0.5rem', color: '#ffb4b4' }}>{error}</p> : null}
        {loading ? <p style={{ margin: 0 }}>Loading clients...</p> : null}

        {!loading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #2f2f2f' }}>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Client</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Contact</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Status</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Client Type</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Source</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Instagram</th>
                  <th style={{ padding: '0.55rem 0.4rem' }} />
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      <div style={{ fontWeight: 700 }}>
                        {[client.firstName, client.lastName].filter(Boolean).join(' ')}
                      </div>
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem', fontSize: 12, opacity: 0.85 }}>
                      <div>{client.phoneE164 || '—'}</div>
                      <div>{client.email || '—'}</div>
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      <span style={{ border: '1px solid #333', borderRadius: 999, padding: '0.12rem 0.45rem', fontSize: 12 }}>
                        {client.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      <span style={{ border: '1px solid #333', borderRadius: 999, padding: '0.12rem 0.45rem', fontSize: 12 }}>
                        {client.clientType || 'new'}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem', opacity: 0.8 }}>{client.source || '—'}</td>
                    <td style={{ padding: '0.55rem 0.4rem', opacity: 0.8 }}>{client.instagramHandle || '—'}</td>
                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>
                      <Link
                        href={`/clients/${client.id}`}
                        style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.3rem 0.65rem', cursor: 'pointer', textDecoration: 'none', fontSize: 13 }}
                      >
                        View
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(client.id);
                          setEditForm(formFromClient(client));
                        }}
                        style={{ marginLeft: 8, border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.3rem 0.65rem', cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {!clients.length ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '0.75rem 0.4rem', opacity: 0.75 }}>No clients found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {editingId && editForm ? (
        <>
          <div onClick={() => { if (!editSaving) { setEditingId(''); setEditForm(null); } }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }} />
          <aside style={{ position: 'fixed', top: 0, right: 0, width: 'min(620px, 100vw)', height: '100vh', zIndex: 41, background: 'linear-gradient(180deg, rgba(19,14,14,0.98), rgba(13,10,10,0.98))', borderLeft: '1px solid #332424', boxShadow: '-12px 0 40px rgba(0,0,0,0.35)', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
            <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #2a1f1f', display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.75rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Edit Client</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: 13, opacity: 0.75 }}>Update contact details, status and notes.</p>
              </div>
              <button type="button" onClick={() => { if (!editSaving) { setEditingId(''); setEditForm(null); } }} style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer' }}>Close</button>
            </div>
            <div style={{ overflow: 'auto', padding: '0.9rem 1rem' }}>
              <ClientForm
                value={editForm}
                onChange={setEditForm}
                onSubmit={saveClientEdit}
                submitting={editSaving}
                submitLabel="Save Client"
                onCancel={() => { if (!editSaving) { setEditingId(''); setEditForm(null); } }}
                duplicateState={editDuplicateState}
              />
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
