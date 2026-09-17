/**
 * The figures a printed bill shows that are NOT stored on the invoice.
 *
 * Everything on the totals block — discount, taxAmount, shippingCharge,
 * roundOff, total, paid — is a real stored field, so every layout prints the
 * same number by simply reading it. The two below are derived, and before
 * this file each printable derived them itself. With one A4 layout that was
 * merely duplication; with the 6x4 sheet added it is a live risk, because a
 * shop can print the same bill on two sizes and hand both to the same
 * customer. Derive them once.
 */

import type { Invoice } from "@/types";

export interface InvoicePrintTotals {
  /** Sum of every line's qty x price less its own line discount, before GST. */
  taxableTotal: number;
  /** Taxable value and tax, grouped by GST rate — the rate-wise summary a
   * tax invoice has to carry. Empty when the bill is not a GST bill. */
  gstBuckets: Record<string, { taxable: number; tax: number }>;
  /** Sum of the printed "Amount" column (taxable + GST per line). NOT the
   * grand total: that also applies extra discount, shipping and round-off,
   * which is exactly why the line table's own footer must use this one. */
  lineAmountTotal: number;
  /** Total pieces on the bill. */
  totalQty: number;
}

export function invoicePrintTotals(inv: Invoice): InvoicePrintTotals {
  const gstOn = inv.gstEnabled !== false;
  const gstBuckets: InvoicePrintTotals["gstBuckets"] = {};
  let taxableTotal = 0;
  let lineAmountTotal = 0;
  let totalQty = 0;

  for (const l of inv.lineItems) {
    const taxable = l.qty * l.price * (1 - l.discountPct / 100);
    taxableTotal += taxable;
    totalQty += l.qty;
    const gstAmt = gstOn ? taxable * (l.gstRate / 100) : 0;
    lineAmountTotal += taxable + gstAmt;
    if (gstOn) {
      const key = l.gstRate.toString();
      if (!gstBuckets[key]) gstBuckets[key] = { taxable: 0, tax: 0 };
      gstBuckets[key].taxable += taxable;
      gstBuckets[key].tax += taxable * (l.gstRate / 100);
    }
  }

  return { taxableTotal, gstBuckets, lineAmountTotal, totalQty };
}

/** Total GST across every rate on the bill, for layouts too small to print
 * the rate-wise table. */
export function totalGstOf(totals: InvoicePrintTotals): number {
  return Object.values(totals.gstBuckets).reduce((s, b) => s + b.tax, 0);
}

/* ── Amount in words (Indian numbering) ──────────────────────────────── */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function inWords(num: number): string {
  if (num < 20) return ONES[num];
  if (num < 100) return TENS[Math.floor(num / 10)] + (num % 10 ? " " + ONES[num % 10] : "");
  if (num < 1000)
    return ONES[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + inWords(num % 100) : "");
  if (num < 100000)
    return (
      inWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + inWords(num % 1000) : "")
    );
  if (num < 10000000)
    return (
      inWords(Math.floor(num / 100000)) +
      " Lakh" +
      (num % 100000 ? " " + inWords(num % 100000) : "")
    );
  return (
    inWords(Math.floor(num / 10000000)) +
    " Crore" +
    (num % 10000000 ? " " + inWords(num % 10000000) : "")
  );
}

/** "One Thousand Two Hundred Rupees and Fifty Paise Only" — the line every
 * printed bill carries under the grand total. */
export function amountInWords(n: number): string {
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let s = inWords(rupees) + " Rupees";
  if (paise) s += " and " + inWords(paise) + " Paise";
  return s + " Only";
}
