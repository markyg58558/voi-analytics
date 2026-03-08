'use client';

import { useEffect, useMemo, useState } from 'react';

const DURATION_OPTIONS = Array.from({ length: 32 }, (_, idx) => (idx + 1) * 15);

function formatDurationLabel(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hrs) return `${mins} min`;
  if (!mins) return hrs === 1 ? '1 hr' : `${hrs} hrs`;
  return `${hrs}h ${mins}m`;
}

function emptyServiceForm() {
  return {
    name: '',
    category: 'Tattoo Sessions',
    durationMinutes: '60',
    basePrice: '',
    taxable: false,
    active: true
  };
}

function normalizeServicePayload(form) {
  return {
    name: form.name.trim(),
    category: form.category.trim(),
    durationMinutes: Number(form.durationMinutes),
    basePrice: form.basePrice === '' ? null : Number(form.basePrice),
    taxable: Boolean(form.taxable),
    active: Boolean(form.active)
  };
}

function normalizePricingPayload(form, artistId) {
  return {
    artistId,
    priceAmount: form.priceAmount === '' ? null : Number(form.priceAmount),
    durationMinutes: form.durationMinutes === '' ? null : Number(form.durationMinutes),
    active: Boolean(form.active)
  };
}

function pricingFormFromRow(row, service) {
  return {
    priceAmount: row?.priceAmount == null ? '' : String(row.priceAmount),
    durationMinutes: row?.durationMinutes == null ? '' : String(row.durationMinutes),
    active: row?.active ?? true
  };
}

function serviceFormFromService(service) {
  return {
    name: service?.name || '',
    category: service?.category || '',
    durationMinutes: service?.durationMinutes == null ? '' : String(service.durationMinutes),
    basePrice: service?.basePrice == null ? '' : String(service.basePrice),
    taxable: Boolean(service?.taxable),
    active: Boolean(service?.active)
  };
}

export default function ServiceAdminPanel() {
  const [services, setServices] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [createForm, setCreateForm] = useState(emptyServiceForm());
  const [createSaving, setCreateSaving] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [pricingForm, setPricingForm] = useState({ priceAmount: '', durationMinutes: '', active: true });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [serviceEditForm, setServiceEditForm] = useState(null);
  const [serviceEditSaving, setServiceEditSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [servicesRes, artistsRes] = await Promise.all([
          fetch('/api/services?includeInactive=true&includeAllPricing=true', { cache: 'no-store' }),
          fetch('/api/artists?includeInactive=true', { cache: 'no-store' })
        ]);
        const [servicesData, artistsData] = await Promise.all([servicesRes.json(), artistsRes.json()]);
        if (!servicesRes.ok || !servicesData.ok) throw new Error(servicesData?.error || `Failed to load services (${servicesRes.status})`);
        if (!artistsRes.ok || !artistsData.ok) throw new Error(artistsData?.error || `Failed to load artists (${artistsRes.status})`);
        if (cancelled) return;
        const serviceList = servicesData.services || [];
        const artistList = artistsData.artists || [];
        setServices(serviceList);
        setArtists(artistList);
        if (!selectedServiceId && serviceList[0]) setSelectedServiceId(serviceList[0].id);
        if (!selectedArtistId && artistList[0]) setSelectedArtistId(artistList[0].id);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load admin services');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedArtistId, selectedServiceId]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const visibleServices = useMemo(
    () => (showInactive ? services : services.filter((service) => service.active)),
    [services, showInactive]
  );
  const selectedService = services.find((s) => s.id === selectedServiceId) || null;

  useEffect(() => {
    if (!selectedService || !selectedArtistId) return;
    const row = (selectedService.artistPricing || []).find((p) => p.artistId === selectedArtistId) || null;
    setPricingForm(pricingFormFromRow(row, selectedService));
  }, [selectedArtistId, selectedService]);

  useEffect(() => {
    if (!selectedService) {
      setServiceEditForm(null);
      return;
    }
    setServiceEditForm(serviceFormFromService(selectedService));
  }, [selectedService]);

  async function createService(e) {
    e.preventDefault();
    setCreateSaving(true);
    setError('');
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeServicePayload(createForm))
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to create service (${res.status})`);
      setServices((prev) => [...prev, { ...data.service, artistPricing: [] }].sort((a, b) => `${a.category}:${a.name}`.localeCompare(`${b.category}:${b.name}`)));
      setCreateForm(emptyServiceForm());
      setSelectedServiceId(data.service.id);
      setToast(`Added service: ${data.service.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create service');
    } finally {
      setCreateSaving(false);
    }
  }

  async function savePricing() {
    if (!selectedServiceId || !selectedArtistId) return;
    setPricingSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/services/${selectedServiceId}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizePricingPayload(pricingForm, selectedArtistId))
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to save pricing (${res.status})`);
      setServices((prev) =>
        prev.map((service) => {
          if (service.id !== selectedServiceId) return service;
          const nextPricing = [...(service.artistPricing || [])];
          const idx = nextPricing.findIndex((p) => p.artistId === selectedArtistId);
          if (idx >= 0) nextPricing[idx] = data.pricing;
          else nextPricing.push(data.pricing);
          return { ...service, artistPricing: nextPricing };
        })
      );
      setToast('Artist pricing saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save artist pricing');
    } finally {
      setPricingSaving(false);
    }
  }

  async function saveServiceEdits() {
    if (!selectedServiceId || !serviceEditForm) return;
    setServiceEditSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/services/${selectedServiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeServicePayload(serviceEditForm))
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || `Failed to update service (${res.status})`);

      setServices((prev) =>
        prev
          .map((service) =>
            service.id === selectedServiceId
              ? { ...service, ...data.service, artistPricing: service.artistPricing || [] }
              : service
          )
          .sort((a, b) => `${a.category}:${a.name}`.localeCompare(`${b.category}:${b.name}`))
      );
      setToast(`Saved service: ${data.service.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update service');
    } finally {
      setServiceEditSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: 16 }}>Add Service Preset</h3>
        <form onSubmit={createService} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Name</span>
            <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} required style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Category</span>
            <input value={createForm.category} onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
          </label>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Duration (min)</span>
            <select value={createForm.durationMinutes} onChange={(e) => setCreateForm((p) => ({ ...p, durationMinutes: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
              {DURATION_OPTIONS.map((minutes) => (
                <option key={minutes} value={String(minutes)}>
                  {formatDurationLabel(minutes)}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.3rem' }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Base Price (AUD)</span>
            <input type="number" min="0" step="0.01" value={createForm.basePrice} onChange={(e) => setCreateForm((p) => ({ ...p, basePrice: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
            <input type="checkbox" checked={createForm.taxable} onChange={(e) => setCreateForm((p) => ({ ...p, taxable: e.target.checked }))} />
            <span style={{ fontSize: 13 }}>Taxable</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
            <input type="checkbox" checked={createForm.active} onChange={(e) => setCreateForm((p) => ({ ...p, active: e.target.checked }))} />
            <span style={{ fontSize: 13 }}>Active</span>
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" disabled={createSaving} style={{ border: '1px solid #2ec4b6', background: 'rgba(46,196,182,0.1)', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.8rem', cursor: createSaving ? 'progress' : 'pointer' }}>
              {createSaving ? 'Adding...' : 'Add Service'}
            </button>
          </div>
        </form>
      </section>

      <section style={{ border: '1px solid #333', borderRadius: 12, padding: '0.9rem', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Service Presets & Artist Pricing</h3>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.75, fontSize: 13 }}>Select a preset, then set artist-specific price/duration defaults.</p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: 13 }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive services
          </label>
        </div>
        {toast ? <p style={{ margin: '0 0 0.5rem', color: '#9de6c1' }}>{toast}</p> : null}
        {error ? <p style={{ margin: '0 0 0.5rem', color: '#ffb4b4' }}>{error}</p> : null}
        {loading ? <p style={{ margin: 0 }}>Loading services...</p> : null}

        {!loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) minmax(320px, 1fr)', gap: '0.9rem' }}>
            <div style={{ border: '1px solid #2f2f2f', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '0.6rem 0.7rem', borderBottom: '1px solid #2f2f2f', fontSize: 13, opacity: 0.8 }}>Services</div>
              <div style={{ maxHeight: 440, overflow: 'auto' }}>
                {visibleServices.map((service) => {
                  const selected = service.id === selectedServiceId;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceId(service.id)}
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ fontWeight: 700 }}>{service.name}</div>
                        <span style={{ fontSize: 12, opacity: 0.75 }}>{service.active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {service.category} • {service.durationMinutes}m • {service.basePrice == null ? '—' : `${service.basePrice} AUD`}
                      </div>
                    </button>
                  );
                })}
                {visibleServices.length === 0 ? <div style={{ padding: '0.75rem', opacity: 0.75 }}>No services yet.</div> : null}
              </div>
            </div>

            <div style={{ border: '1px solid #2f2f2f', borderRadius: 10, padding: '0.8rem' }}>
              {selectedService ? (
                <>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 700 }}>{selectedService.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      Base: {selectedService.durationMinutes}m • {selectedService.basePrice == null ? 'No base price' : `${selectedService.basePrice} AUD`}
                    </div>
                  </div>

                  {serviceEditForm ? (
                    <div style={{ border: '1px solid #2f2f2f', borderRadius: 10, padding: '0.75rem', marginBottom: '0.8rem', background: 'rgba(255,255,255,0.01)' }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.55rem', fontSize: 14 }}>Service Details</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
                        <label style={{ display: 'grid', gap: '0.3rem' }}>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>Name</span>
                          <input value={serviceEditForm.name} onChange={(e) => setServiceEditForm((p) => ({ ...p, name: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                        </label>
                        <label style={{ display: 'grid', gap: '0.3rem' }}>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>Category</span>
                          <input value={serviceEditForm.category} onChange={(e) => setServiceEditForm((p) => ({ ...p, category: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                        </label>
                        <label style={{ display: 'grid', gap: '0.3rem' }}>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>Duration (min)</span>
                          <select value={serviceEditForm.durationMinutes} onChange={(e) => setServiceEditForm((p) => ({ ...p, durationMinutes: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
                            {DURATION_OPTIONS.map((minutes) => (
                              <option key={minutes} value={String(minutes)}>
                                {formatDurationLabel(minutes)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: '0.3rem' }}>
                          <span style={{ fontSize: 12, opacity: 0.75 }}>Base Price (AUD)</span>
                          <input type="number" min="0" step="0.01" value={serviceEditForm.basePrice} onChange={(e) => setServiceEditForm((p) => ({ ...p, basePrice: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
                          <input type="checkbox" checked={serviceEditForm.taxable} onChange={(e) => setServiceEditForm((p) => ({ ...p, taxable: e.target.checked }))} />
                          <span style={{ fontSize: 13 }}>Taxable</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
                          <input type="checkbox" checked={serviceEditForm.active} onChange={(e) => setServiceEditForm((p) => ({ ...p, active: e.target.checked }))} />
                          <span style={{ fontSize: 13 }}>Active</span>
                        </label>
                      </div>
                      <div style={{ marginTop: '0.7rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setServiceEditForm(serviceFormFromService(selectedService))}
                          disabled={serviceEditSaving}
                          style={{ border: '1px solid #333', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '0.4rem 0.75rem', cursor: 'pointer' }}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={saveServiceEdits}
                          disabled={serviceEditSaving}
                          style={{ border: '1px solid #f7b955', background: 'rgba(247,185,85,0.1)', color: 'inherit', borderRadius: 999, padding: '0.4rem 0.75rem', cursor: serviceEditSaving ? 'progress' : 'pointer' }}
                        >
                          {serviceEditSaving ? 'Saving...' : serviceEditForm.active ? 'Save Service' : 'Save (Inactive)'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <label style={{ display: 'grid', gap: '0.3rem', marginBottom: '0.65rem' }}>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>Artist</span>
                    <select
                      value={selectedArtistId}
                      onChange={(e) => setSelectedArtistId(e.target.value)}
                      style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}
                    >
                      {artists.filter((a) => a.active).map((artist) => (
                        <option key={artist.id} value={artist.id}>
                          {artist.displayName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Price (AUD)</span>
                      <input type="number" min="0" step="0.01" value={pricingForm.priceAmount} onChange={(e) => setPricingForm((p) => ({ ...p, priceAmount: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }} />
                    </label>
                    <label style={{ display: 'grid', gap: '0.3rem' }}>
                      <span style={{ fontSize: 12, opacity: 0.75 }}>Duration (min)</span>
                      <select value={pricingForm.durationMinutes} onChange={(e) => setPricingForm((p) => ({ ...p, durationMinutes: e.target.value }))} style={{ padding: '0.55rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: 'inherit' }}>
                        <option value="">Use service default</option>
                        {DURATION_OPTIONS.map((minutes) => (
                          <option key={minutes} value={String(minutes)}>
                            {formatDurationLabel(minutes)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.85rem' }}>
                      <input type="checkbox" checked={pricingForm.active} onChange={(e) => setPricingForm((p) => ({ ...p, active: e.target.checked }))} />
                      <span style={{ fontSize: 13 }}>Active pricing override</span>
                    </label>
                  </div>

                  <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={savePricing}
                      disabled={!selectedArtistId || pricingSaving}
                      style={{ border: '1px solid #7dd3fc', background: 'rgba(125,211,252,0.1)', color: 'inherit', borderRadius: 999, padding: '0.45rem 0.8rem', cursor: pricingSaving ? 'progress' : 'pointer' }}
                    >
                      {pricingSaving ? 'Saving...' : 'Save Artist Pricing'}
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, opacity: 0.8 }}>Select a service to manage artist pricing.</p>
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
