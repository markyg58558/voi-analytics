<script>
(function () {
  const KEYS = [
    'gclid',
    'fbclid',
    'msclkid',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content'
  ];

  const qs = new URLSearchParams(window.location.search);

  // Persist incoming attribution params whenever present.
  KEYS.forEach((key) => {
    const value = qs.get(key);
    if (value) localStorage.setItem(key, value);
  });

  function setField(name, value) {
    const el = document.querySelector('[name="' + name + '"]');
    if (el && !el.value) el.value = value || '';
  }

  function ensureLeadId() {
    let leadId = localStorage.getItem('lead_id');
    if (!leadId) {
      leadId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('lead_id', leadId);
    }
    return leadId;
  }

  function fillHiddenFields() {
    setField('lead_id', ensureLeadId());
    KEYS.forEach((key) => setField(key, localStorage.getItem(key)));

    // First landing URL for attribution.
    if (!localStorage.getItem('landing_page_url')) {
      localStorage.setItem('landing_page_url', window.location.href);
    }

    setField('landing_page_url', localStorage.getItem('landing_page_url'));
    setField('referrer_url', document.referrer || '');
  }

  document.addEventListener('DOMContentLoaded', fillHiddenFields);
  // Extra pass for forms rendered after initial load (Elementor async behavior).
  setTimeout(fillHiddenFields, 1200);
})();
</script>
