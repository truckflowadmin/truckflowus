/**
 * Format a quantity value for display.
 * TONS → show exact value as-is (e.g. 12.5 tn)
 * LOADS / YARDS → whole number
 */
export function fmtQty(quantity: number | string | { toNumber?: () => number }, quantityType: string): string {
  const n = typeof quantity === 'object' && quantity !== null && 'toNumber' in quantity
    ? (quantity as any).toNumber()
    : Number(quantity);
  if (quantityType === 'TONS') return n.toFixed(2);
  return String(Math.round(n));
}

/** Short unit label for a quantity type */
export function qtyUnit(quantityType: string): string {
  if (quantityType === 'TONS') return 'tn';
  if (quantityType === 'YARDS') return 'yd';
  return 'ld';
}
