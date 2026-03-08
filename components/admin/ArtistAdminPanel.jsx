'use client';

import { useEffect, useMemo, useState } from 'react';

function emptyCreateForm() {
  return {
    displayName: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneE164: '',
    commissionRatePct: '',
    gstRegistered: false,
    active: true,
    abn: ''
  };
}

function formFromArtist(artist) {
  return {
    displayName: artist.displayName || '',
    firstName: artist.firstName || '',
    lastName: artist.lastName || '',
    email: artist.email || '',
    phoneE164: artist.phoneE164 || '',
    commissionRatePct: artist.commissionRatePct == null ? '' : String(artist.commissionRatePct),
    gstRegistered: Boolean(artist.gstRegistered),
    active: Boolean(artist.active),
    abn: artist.abn || ''
  };
}

function normalizePayload(form) {
  return {
    displayName: form.displayName.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phoneE164: normalizeAustralianPhoneForReception(form.phoneE164),
    commissionRatePct: form.commissionRatePct === '' ? null : Number(form.commissionRatePct),
    gstRegistered: Boolean(form.gstRegistered),
    active: Boolean(form.active),
    abn: form.abn.trim()
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

function ArtistForm({ value, onChange, onSubmit, submitting, submitLabel, onCancel }) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.65rem'
      }}
    >
      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Display Name</span>
        <input
          value={value.displayName}
          onChange={(e) => onChange((prev) => ({ ...prev, displayName: e.target.value }))}
          required
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>First Name</span>
        <input
          value={value.firstName}
          onChange={(e) => onChange((prev) => ({ ...prev, firstName: e.target.value }))}
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Last Name</span>
        <input
          value={value.lastName}
          onChange={(e) => onChange((prev) => ({ ...prev, lastName: e.target.value }))}
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Email</span>
        <input
          type="email"
          value={value.email}
          onChange={(e) => onChange((prev) => ({ ...prev, email: e.target.value }))}
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Phone</span>
        <input
          value={value.phoneE164}
          onChange={(e) => onChange((prev) => ({ ...prev, phoneE164: e.target.value }))}
          onBlur={(e) => onChange((prev) => ({ ...prev, phoneE164: normalizeAustralianPhoneForReception(e.target.value) }))}
          placeholder="0418731287"
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>Commission %</span>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={value.commissionRatePct}
          onChange={(e) => onChange((prev) => ({ ...prev, commissionRatePct: e.target.value }))}
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>

      <label style={{ display: 'grid', gap: '0.3rem' }}>
        <span style={{ fontSize: 12, opacity: 0.75 }}>ABN</span>
        <input
          value={value.abn}
          onChange={(e) => onChange((prev) => ({ ...prev, abn: e.target.value }))}
          style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
        <input
          type="checkbox"
          checked={value.gstRegistered}
          onChange={(e) => onChange((prev) => ({ ...prev, gstRegistered: e.target.checked }))}
        />
        <span style={{ fontSize: 13 }}>GST Registered</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
        <input
          type="checkbox"
          checked={value.active}
          onChange={(e) => onChange((prev) => ({ ...prev, active: e.target.checked }))}
        />
        <span style={{ fontSize: 13 }}>Active</span>
      </label>

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.55rem', justifyContent: 'flex-end' }}>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.8rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          style={{
            border: '1px solid #2ec4b6',
            background: 'rgba(46,196,182,0.1)',
            color: 'inherit',
            borderRadius: 999,
            padding: '0.45rem 0.8rem',
            cursor: submitting ? 'progress' : 'pointer'
          }}
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function ArtistAdminPanel() {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [createSaving, setCreateSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadArtists() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ includeInactive: 'true' });
        const res = await fetch(`/api/artists?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to load artists (${res.status})`);
        if (!cancelled) setArtists(data.artists || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load artists');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadArtists();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  const visibleArtists = useMemo(
    () => (showInactive ? artists : artists.filter((artist) => artist.active)),
    [artists, showInactive]
  );

  async function handleCreate(e) {
    e.preventDefault();
    setCreateSaving(true);
    setError('');
    try {
      const res = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizePayload(createForm))
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to create artist (${res.status})`);
      setArtists((prev) => [...prev, data.artist].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setCreateForm(emptyCreateForm());
      setToast(`Added ${data.artist.displayName}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create artist');
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editingId || !editForm) return;
    setEditSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/artists/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizePayload(editForm))
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to update artist (${res.status})`);
      setArtists((prev) =>
        prev
          .map((artist) => (artist.id === editingId ? data.artist : artist))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
      );
      setToast(`Saved ${data.artist.displayName}`);
      setEditingId('');
      setEditForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update artist');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteArtist(artist) {
    const label = artist.displayName || 'this artist';
    const confirmed = window.confirm(`Delete ${label}? This only works if there are no appointments linked to this artist.`);
    if (!confirmed) return;

    setError('');
    try {
      const res = await fetch(`/api/artists/${artist.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `Failed to delete artist (${res.status})`);
      }
      setArtists((prev) => prev.filter((row) => row.id !== artist.id));
      if (editingId === artist.id) {
        setEditingId('');
        setEditForm(null);
      }
      setToast(`Deleted ${label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete artist');
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section
        style={{
          border: '1px solid #333',
          borderRadius: 12,
          padding: '0.9rem',
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Add Artist</h3>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.75, fontSize: 13 }}>
              Add artists and commission metadata without touching existing bookings.
            </p>
          </div>
        </div>
        <ArtistForm
          value={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          submitting={createSaving}
          submitLabel="Add Artist"
        />
      </section>

      <section
        style={{
          border: '1px solid #333',
          borderRadius: 12,
          padding: '0.9rem',
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Artists</h3>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.75, fontSize: 13 }}>
              Manage active status, commission %, GST registration and names.
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: 13 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>

        {toast ? <p style={{ margin: '0 0 0.5rem', color: '#9de6c1' }}>{toast}</p> : null}
        {error ? <p style={{ margin: '0 0 0.5rem', color: '#ffb4b4' }}>{error}</p> : null}
        {loading ? <p style={{ margin: 0 }}>Loading artists...</p> : null}

        {!loading ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #2f2f2f' }}>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Artist</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Contact</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Commission</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>GST</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>Active</th>
                  <th style={{ padding: '0.55rem 0.4rem' }}>ABN</th>
                  <th style={{ padding: '0.55rem 0.4rem' }} />
                </tr>
              </thead>
              <tbody>
                {visibleArtists.map((artist) => (
                  <tr key={artist.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      <div style={{ fontWeight: 700 }}>{artist.displayName}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {[artist.firstName, artist.lastName].filter(Boolean).join(' ') || 'No first/last name'}
                      </div>
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem', fontSize: 12, opacity: 0.85 }}>
                      <div>{artist.phoneE164 || '—'}</div>
                      <div>{artist.email || '—'}</div>
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      {artist.commissionRatePct == null ? '—' : `${artist.commissionRatePct}%`}
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>{artist.gstRegistered ? 'Yes' : 'No'}</td>
                    <td style={{ padding: '0.55rem 0.4rem' }}>
                      <span
                        style={{
                          border: `1px solid ${artist.active ? '#6bd39d' : '#666'}`,
                          color: artist.active ? '#6bd39d' : '#aaa',
                          borderRadius: 999,
                          padding: '0.12rem 0.45rem',
                          fontSize: 12
                        }}
                      >
                        {artist.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.55rem 0.4rem', opacity: 0.85 }}>{artist.abn || '—'}</td>
                    <td style={{ padding: '0.55rem 0.4rem', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(artist.id);
                          setEditForm(formFromArtist(artist));
                        }}
                        style={{
                          border: '1px solid #333',
                          background: 'transparent',
                          color: 'inherit',
                          borderRadius: 999,
                          padding: '0.3rem 0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteArtist(artist)}
                        style={{
                          marginLeft: 8,
                          border: '1px solid #7a2f2f',
                          background: 'rgba(239,143,143,0.08)',
                          color: '#ffc5c5',
                          borderRadius: 999,
                          padding: '0.3rem 0.65rem',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleArtists.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '0.75rem 0.4rem', opacity: 0.75 }}>
                      No artists found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {editingId && editForm ? (
        <>
          <div
            onClick={() => {
              if (editSaving) return;
              setEditingId('');
              setEditForm(null);
            }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
          />
          <aside
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: 'min(520px, 100vw)',
              height: '100vh',
              zIndex: 41,
              background: 'linear-gradient(180deg, rgba(19,14,14,0.98), rgba(13,10,10,0.98))',
              borderLeft: '1px solid #332424',
              boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr'
            }}
          >
            <div style={{ padding: '0.9rem 1rem', borderBottom: '1px solid #2a1f1f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.75rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Edit Artist</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: 13, opacity: 0.75 }}>Update profile + commission settings.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (editSaving) return;
                    setEditingId('');
                    setEditForm(null);
                  }}
                  style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ overflow: 'auto', padding: '0.9rem 1rem' }}>
              <ArtistForm
                value={editForm}
                onChange={setEditForm}
                onSubmit={handleSaveEdit}
                submitting={editSaving}
                submitLabel="Save Artist"
                onCancel={() => {
                  if (editSaving) return;
                  setEditingId('');
                  setEditForm(null);
                }}
              />
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
