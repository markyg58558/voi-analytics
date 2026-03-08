'use client';

import { useEffect, useMemo, useState } from 'react';

const DAYS = [
  { dayOfWeek: 0, label: 'Sun' },
  { dayOfWeek: 1, label: 'Mon' },
  { dayOfWeek: 2, label: 'Tue' },
  { dayOfWeek: 3, label: 'Wed' },
  { dayOfWeek: 4, label: 'Thu' },
  { dayOfWeek: 5, label: 'Fri' },
  { dayOfWeek: 6, label: 'Sat' }
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? '30' : '00';
  const value = `${String(h).padStart(2, '0')}:${m}:00`;
  const labelDate = new Date(Date.UTC(2026, 0, 1, h, Number(m)));
  const label = new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  }).format(labelDate);
  return { value, label: label.toLowerCase() };
});

function buildDefaultWeek() {
  return DAYS.map((d) => ({
    dayOfWeek: d.dayOfWeek,
    active: false,
    startLocalTime: '11:00:00',
    endLocalTime: '18:00:00'
  }));
}

function mergeWeekRows(rows = []) {
  const byDay = new Map(rows.map((r) => [Number(r.dayOfWeek), r]));
  return DAYS.map((d) => {
    const row = byDay.get(d.dayOfWeek);
    return {
      dayOfWeek: d.dayOfWeek,
      active: row ? Boolean(row.active) : false,
      startLocalTime: row?.startLocalTime || '11:00:00',
      endLocalTime: row?.endLocalTime || '18:00:00'
    };
  });
}

export default function ArtistAvailabilityPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [artists, setArtists] = useState([]);
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [weekForm, setWeekForm] = useState(buildDefaultWeek());
  const [showInactiveArtists, setShowInactiveArtists] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/artists/weekly-availability', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to load availability (${res.status})`);
        if (cancelled) return;
        const list = data.artists || [];
        setArtists(list);
        if (list.length) {
          const firstActive = list.find((a) => a.active) || list[0];
          setSelectedArtistId(firstActive.id);
          setWeekForm(mergeWeekRows(firstActive.weeklyAvailability));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load availability');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const visibleArtists = useMemo(
    () => (showInactiveArtists ? artists : artists.filter((a) => a.active)),
    [artists, showInactiveArtists]
  );

  const selectedArtist = artists.find((a) => a.id === selectedArtistId) || null;

  useEffect(() => {
    if (!selectedArtist) return;
    setWeekForm(mergeWeekRows(selectedArtist.weeklyAvailability));
  }, [selectedArtistId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveAvailability() {
    if (!selectedArtistId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/artists/weekly-availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId: selectedArtistId,
          entries: weekForm
        })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to save availability (${res.status})`);

      setArtists((prev) =>
        prev.map((artist) =>
          artist.id === selectedArtistId
            ? { ...artist, weeklyAvailability: data.weeklyAvailability || [] }
            : artist
        )
      );
      setToast(`Saved weekly availability for ${selectedArtist?.displayName || 'artist'}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.35rem', fontSize: 16 }}>Weekly Artist Availability</h3>
        <p style={{ margin: '0 0 0.7rem', opacity: 0.78, fontSize: 13 }}>
          Use this as the base recurring working hours for each artist. One-off changes and breaks can still use blocked time.
        </p>
        {toast ? <p style={{ margin: '0 0 0.5rem', color: '#9de6c1' }}>{toast}</p> : null}
        {error ? <p style={{ margin: '0 0 0.5rem', color: '#ffb4b4' }}>{error}</p> : null}
        {loading ? <p style={{ margin: 0 }}>Loading availability...</p> : null}

        {!loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '0.9rem' }}>
            <div style={{ border: '1px solid #2f2f2f', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #2f2f2f', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: 13, opacity: 0.85 }}>Artists</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: 12 }}>
                  <input type="checkbox" checked={showInactiveArtists} onChange={(e) => setShowInactiveArtists(e.target.checked)} />
                  Inactive
                </label>
              </div>
              <div style={{ maxHeight: 460, overflow: 'auto' }}>
                {visibleArtists.map((artist) => {
                  const selected = artist.id === selectedArtistId;
                  return (
                    <button
                      key={artist.id}
                      type="button"
                      onClick={() => setSelectedArtistId(artist.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: selected ? 'rgba(46,196,182,0.08)' : 'transparent',
                        color: 'inherit',
                        padding: '0.65rem 0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{artist.displayName}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{artist.active ? 'Active' : 'Inactive'}</div>
                    </button>
                  );
                })}
                {!visibleArtists.length ? <div style={{ padding: '0.75rem', opacity: 0.75 }}>No artists found.</div> : null}
              </div>
            </div>

            <div style={{ border: '1px solid #2f2f2f', borderRadius: 10, padding: '0.8rem', display: 'grid', gap: '0.7rem' }}>
              {selectedArtist ? (
                <>
                  <div>
                    <div style={{ fontWeight: 700 }}>{selectedArtist.displayName}</div>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Base recurring weekly availability</div>
                  </div>

                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {weekForm.map((row, idx) => {
                      const day = DAYS.find((d) => d.dayOfWeek === row.dayOfWeek);
                      return (
                        <div
                          key={row.dayOfWeek}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '64px 90px 1fr 1fr',
                            gap: '0.5rem',
                            alignItems: 'center',
                            border: '1px solid #2f2f2f',
                            borderRadius: 10,
                            padding: '0.45rem 0.55rem',
                            background: row.active ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.005)'
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{day?.label || row.dayOfWeek}</div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(e) =>
                                setWeekForm((prev) => {
                                  const next = [...prev];
                                  next[idx] = { ...row, active: e.target.checked };
                                  return next;
                                })
                              }
                            />
                            Works
                          </label>
                          <select
                            value={row.startLocalTime}
                            disabled={!row.active}
                            onChange={(e) =>
                              setWeekForm((prev) => {
                                const next = [...prev];
                                next[idx] = { ...row, startLocalTime: e.target.value };
                                return next;
                              })
                            }
                            style={{ padding: '0.45rem', borderRadius: 8, border: '1px solid #333', background: row.active ? '#111' : '#151515', color: 'inherit', opacity: row.active ? 1 : 0.65 }}
                          >
                            {TIME_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <select
                            value={row.endLocalTime}
                            disabled={!row.active}
                            onChange={(e) =>
                              setWeekForm((prev) => {
                                const next = [...prev];
                                next[idx] = { ...row, endLocalTime: e.target.value };
                                return next;
                              })
                            }
                            style={{ padding: '0.45rem', borderRadius: 8, border: '1px solid #333', background: row.active ? '#111' : '#151515', color: 'inherit', opacity: row.active ? 1 : 0.65 }}
                          >
                            {TIME_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={saveAvailability}
                      disabled={saving}
                      style={{
                        border: '1px solid #7dd3fc',
                        background: 'rgba(125,211,252,0.1)',
                        color: 'inherit',
                        borderRadius: 999,
                        padding: '0.45rem 0.8rem',
                        cursor: saving ? 'progress' : 'pointer'
                      }}
                    >
                      {saving ? 'Saving...' : 'Save Weekly Availability'}
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, opacity: 0.8 }}>Select an artist to edit availability.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

