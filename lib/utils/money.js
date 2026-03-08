export function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

export function fromCents(cents) {
  return Number(cents || 0) / 100;
}

export function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(Number(amount || 0));
}
