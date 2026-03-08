const cards = [
  { label: 'Today Revenue', value: '$0.00', note: 'Wire to SQL view report_daily_sales' },
  { label: 'Pending Deposits', value: '$0.00', note: 'Query appointments in pending_deposit' },
  { label: 'No-Shows (30d)', value: '0', note: 'Aggregate appointment status' },
  { label: 'Artist Utilization', value: '0%', note: 'Scheduled hours / available hours' }
];

export default function RevenueCards() {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
      {cards.map((card) => (
        <article key={card.label} style={{ border: '1px solid #2e2e2e', borderRadius: 12, padding: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', opacity: 0.8 }}>{card.label}</h3>
          <p style={{ margin: '0.5rem 0', fontSize: '1.5rem' }}>{card.value}</p>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.75 }}>{card.note}</p>
        </article>
      ))}
    </section>
  );
}
