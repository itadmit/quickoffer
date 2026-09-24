export type CalcItem = { quantity: number; unitPrice: number };

export type Totals = {
  subtotal: number;
  discount: number;
  /** subtotal after discount, before VAT */
  net: number;
  vatAmount: number;
  total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function lineTotal(item: CalcItem): number {
  return round2(item.quantity * item.unitPrice);
}

/**
 * Prices entered by the professional are treated as VAT-exclusive unless
 * `vatIncluded` is true, in which case the entered prices already contain VAT
 * and we back it out for display (PRODUCT.md §7.2).
 */
export function calcTotals(
  items: CalcItem[],
  opts: { vatRate: number; vatIncluded: boolean; discount: number },
): Totals {
  const gross = round2(items.reduce((s, i) => s + lineTotal(i), 0));
  const discount = Math.min(round2(opts.discount || 0), gross);
  const afterDiscount = round2(gross - discount);

  if (opts.vatRate === 0) {
    return { subtotal: gross, discount, net: afterDiscount, vatAmount: 0, total: afterDiscount };
  }
  if (opts.vatIncluded) {
    const net = round2(afterDiscount / (1 + opts.vatRate));
    return {
      subtotal: gross,
      discount,
      net,
      vatAmount: round2(afterDiscount - net),
      total: afterDiscount,
    };
  }
  const vatAmount = round2(afterDiscount * opts.vatRate);
  return {
    subtotal: gross,
    discount,
    net: afterDiscount,
    vatAmount,
    total: round2(afterDiscount + vatAmount),
  };
}

export const VAT_RATE = 0.18;

export function formatMoney(n: number): string {
  const hasCents = Math.abs(n - Math.round(n)) > 0.004;
  return (
    n.toLocaleString("he-IL", {
      minimumFractionDigits: hasCents ? 2 : 0,
      maximumFractionDigits: 2,
    }) + " ₪"
  );
}

export function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

/**
 * Units that measure nothing. "קומפלט" is how a professional says "for the
 * whole job" and "יח׳" is the default the model falls back to - printed next
 * to the number in the quantity column they read as noise ("1 קומפלט"), so the
 * number stands alone. Real measures (מ״ר, מ״א, שעה, יום, נקודה) stay: there
 * the unit is what the price is per, and dropping it loses meaning.
 */
const UNITLESS = new Set(["קומפלט", "יח׳", "יח'", "יחידה"]);

export function qtyLabel(quantity: number, unit: string | null | undefined): string {
  const u = (unit ?? "").trim();
  const n = formatQty(quantity);
  return !u || UNITLESS.has(u) ? n : `${n} ${u}`;
}
