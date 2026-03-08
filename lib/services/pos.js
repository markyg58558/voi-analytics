export function calculateOrderTotals(items = []) {
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );
  const tax = items.reduce((sum, item) => {
    if (!item.taxable) return sum;
    return sum + Number(item.quantity || 0) * Number(item.unitPrice || 0) * 0;
  }, 0);
  const total = subtotal + tax;

  return {
    subtotalAmount: Number(subtotal.toFixed(2)),
    taxAmount: Number(tax.toFixed(2)),
    totalAmount: Number(total.toFixed(2))
  };
}
