'use client';

import { calculateOrderTotals } from '@/lib/services/pos';
import { formatCurrency } from '@/lib/utils/money';

const sampleItems = [
  { description: 'Session Balance', quantity: 1, unitPrice: 350, taxable: false },
  { description: 'Aftercare Kit', quantity: 1, unitPrice: 25, taxable: true }
];

export default function PosPanel() {
  const totals = calculateOrderTotals(sampleItems);

  return (
    <section style={{ border: '1px solid #2e2e2e', borderRadius: 12, padding: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>POS Checkout (Scaffold)</h2>
      <ul>
        {sampleItems.map((item) => (
          <li key={item.description}>
            {item.description} x{item.quantity} - {formatCurrency(item.unitPrice)}
          </li>
        ))}
      </ul>
      <p>Subtotal: {formatCurrency(totals.subtotalAmount)}</p>
      <p>Total: {formatCurrency(totals.totalAmount)}</p>
      <p style={{ opacity: 0.8 }}>Next step: persist orders/order_items/payments via server routes.</p>
    </section>
  );
}
