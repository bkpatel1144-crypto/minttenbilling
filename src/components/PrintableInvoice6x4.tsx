import type { Invoice, Company } from "@/types";
import { fmtMoney, fmtDateShort } from "@/lib/format";
import { amountInWords, invoicePrintTotals, totalGstOf } from "@/lib/invoicePrint";
import { describePayment } from "@/lib/paymentSplit";
import { BankRepo } from "@/repositories";

const bankName = (id: string) => BankRepo.get(id)?.name;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** A 6x4 inch sheet at the 96dpi the browser lays print out in. Everything
 * below is sized against this, so the preview on screen is the same sheet
 * the printer gets rather than a guess. */
export const SHEET_6X4_W = 576;
export const SHEET_6X4_H = 384;
/**
 * Physical page margins, matched by the @page rule below — in mm, and in the
 * 96dpi pixels the on-screen sheet is laid out in.
 *
 * The sides are twice the top and bottom on purpose. These labels are cut
 * off the roll by hand at the counter, and at an even 4mm gutter the cut was
 * going straight through the party name and the amounts. 8mm gives the
 * scissors somewhere to land that costs nothing but the width of the item
 * column, which had room to spare.
 *
 * Vertical stays at 4mm: height is the tight dimension on a 4in label, and
 * the cut is across the roll, not along it.
 */
const MARGIN_MM_V = 4;
const MARGIN_MM_H = 8;
const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4);
const MARGIN_PX_V = mmToPx(MARGIN_MM_V);
const MARGIN_PX_H = mmToPx(MARGIN_MM_H);

/** Padding for an on-screen preview of this sheet, so the preview shows the
 * same gutters the printer leaves rather than a hardcoded guess. */
export const SHEET_6X4_PADDING = `${MARGIN_PX_V}px ${MARGIN_PX_H}px`;

/**
 * The type scale, in the 96dpi px the browser lays print out in — divide by
 * 1.333 for the point size that actually lands on the paper.
 *
 * This sheet's first version was set at 6.5-7.5px, which is 5pt, and the
 * shop's own printout came back unreadable. A 6x4 label goes to a thermal or
 * label printer around 203dpi with no anti-aliasing and no greys, and
 * anything under about 8pt turns to mush on that hardware. So nothing here
 * that a person has to READ goes below 10.5px (~8pt), and the figures that
 * decide whether the bill is right — party, total, balance — are well above
 * it. Fewer item lines fit per label as a result; that is the correct trade,
 * and a longer bill simply runs onto a second label.
 *
 * If this ever needs to be tightened again, shrink the layout (drop a
 * column, tighten padding) rather than the type.
 */
const FONT = {
  /** 13.5pt */ shopName: 18,
  /** 7.9pt — address, phone, GSTIN */ shopMeta: 10.5,
  /** 8.3pt */ docTitle: 11,
  /** 9pt */ docNumber: 12,
  /** 7.9pt */ docDate: 10.5,
  /** 7.1pt — the small "BILL TO" caption, not data */ caption: 9.5,
  /** 10.5pt */ partyName: 14,
  /** 7.9pt */ partyMeta: 10.5,
  /** 7.9pt */ tableHead: 10.5,
  /** 8.3pt — every figure in the item table */ cell: 11,
  /** 11.3pt */ grandTotal: 15,
  /** 7.5pt */ words: 10,
  /** 7.5pt */ footMeta: 10,
} as const;

/**
 * The bill on a 6x4 inch sheet — the size this shop's label printer is
 * loaded with.
 *
 * NOT the A4 layout scaled down. 6x4 is a quarter of A4's area, so shrinking
 * that layout to fit puts the item table at about 4pt, which is a bill
 * nobody at a counter can read. This is its own typesetting of the same
 * facts: the parts a bill is legally required to carry (shop and GSTIN,
 * party, number, date, lines, taxable value, tax, total) at a size that
 * survives a thermal/label printer, with the parts that only make sense on a
 * full page (rate-wise GST table, terms, bank block) reduced to one summary
 * line. Every figure comes from the same `invoicePrintTotals` the A4 sheet
 * uses, so the two can never disagree about the same bill.
 *
 * A long bill flows onto a second 6x4 sheet rather than being clipped — the
 * item table's <thead> repeats there, which browsers do for table headers
 * across page breaks.
 */
export function PrintableInvoice6x4({
  inv,
  company,
  mode,
  className = "print-area",
}: {
  inv: Invoice;
  company: Company;
  mode: "sale" | "purchase";
  className?: string;
}) {
  const gstOn = inv.gstEnabled !== false;
  const isSale = mode === "sale";
  const { taxableTotal, gstBuckets, totalQty } = invoicePrintTotals(inv);
  const gstTotal = totalGstOf({ taxableTotal, gstBuckets, lineAmountTotal: 0, totalQty });
  const balance = r2(inv.total - inv.paid);
  // Which GST rates are on the bill, as one line ("GST 5%, 12%") instead of
  // the rate-wise table an A4 sheet has room for.
  const rates = Object.keys(gstBuckets)
    .map(Number)
    .sort((a, b) => a - b);

  const cell: React.CSSProperties = {
    // 1px, not a hairline: these sheets go to label/thermal printers at
    // ~203dpi, which cannot resolve a sub-pixel rule and drop it to a broken
    // grey dotted line.
    border: "1px solid #000",
    padding: "1.5px 4px",
    fontSize: FONT.cell,
    lineHeight: 1.2,
  };
  const th: React.CSSProperties = {
    ...cell,
    // No grey fill anywhere on this sheet. A label printer has no greys —
    // it dithers them into a speckle that muddies the text sitting on top.
    // Weight and rules do the same job and stay crisp.
    fontWeight: 700,
    fontSize: FONT.tableHead,
    textAlign: "left",
  };
  /** One line of the totals stack. */
  const tot = (label: string, value: string, strong = false) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: strong ? FONT.grandTotal : FONT.cell,
        fontWeight: strong ? 800 : 400,
        padding: strong ? "3px 4px" : "1.5px 4px",
        borderTop: strong ? "2px solid #000" : undefined,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div
      className={`${className} invoice-6x4`}
      // No `display` here, deliberately: `.print-area` hides this copy with
      // display:none, and an inline display of any kind outranks a
      // stylesheet rule — which put a full 6x4 sheet in the middle of the
      // bill entry form. The sheet's own flex column lives one level down.
      style={{ fontFamily: "Arial, sans-serif", color: "#000", width: "100%" }}
    >
      {/* !important on both descriptors, for the same reason ThermalReceipt
          needs it: src/styles.css sets a global @page { size: A4 } for every
          printable page, and without !important that can win depending on
          the browser's own @page ordering — which would print this sheet's
          content onto A4 paper. The same file's 12mm padding on
          .print-area/.print-visible is sized for a full page; on a 4in-tall
          sheet it would eat two thirds of the height, so the physical margin
          comes from @page instead and the padding is forced off (two classes
          beat one, so this wins without needing to fight specificity). */}
      <style>{`@media print {
        @page { size: 6in 4in !important; margin: ${MARGIN_MM_V}mm ${MARGIN_MM_H}mm !important; }
        .invoice-6x4.print-area, .invoice-6x4.print-visible {
          padding: 0 !important;
          width: 100% !important;
        }
      }`}</style>

      {/* The sheet. Fills the label so the totals and signature sit on its
          bottom edge instead of floating halfway up a mostly-empty card — a
          min-height, never a fixed one, so a bill with more lines than fit
          grows onto a second label rather than being clipped at the fold. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: SHEET_6X4_H - MARGIN_PX_V * 2,
        }}
      >
        {/* Header: shop on the left, document identity on the right */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            borderBottom: "1.5px solid #000",
            paddingBottom: 3,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: FONT.shopName, fontWeight: 800, lineHeight: 1.1 }}>
              {company.name || "Your Company"}
            </div>
            {company.address && <div style={{ fontSize: FONT.shopMeta }}>{company.address}</div>}
            <div style={{ fontSize: FONT.shopMeta }}>
              {company.phone && <>Ph: {company.phone}</>}
              {company.phone && company.email && " · "}
              {company.email}
            </div>
            {gstOn && company.gstin && (
              <div style={{ fontSize: FONT.shopMeta, fontWeight: 700 }}>GSTIN: {company.gstin}</div>
            )}
          </div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: FONT.docTitle, fontWeight: 800, letterSpacing: 0.6 }}>
              {gstOn ? "TAX INVOICE" : isSale ? "INVOICE" : "PURCHASE BILL"}
            </div>
            <div style={{ fontSize: FONT.docNumber, fontWeight: 700 }}>{inv.number}</div>
            <div style={{ fontSize: FONT.docDate }}>{fmtDateShort(inv.date)}</div>
          </div>
        </div>

        {/* Party + payment, one band */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            padding: "3px 0",
            borderBottom: "1px solid #000",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: FONT.caption, fontWeight: 700 }}>
              {isSale ? "BILL TO " : "SUPPLIER "}
            </span>
            <span style={{ fontSize: FONT.partyName, fontWeight: 700 }}>
              {inv.partyName || "—"}
            </span>
            {inv.partyPhone && (
              <span style={{ fontSize: FONT.partyMeta }}> · {inv.partyPhone}</span>
            )}
          </div>
          <div style={{ fontSize: FONT.partyMeta, textAlign: "right", whiteSpace: "nowrap" }}>
            {describePayment(inv, bankName)}
          </div>
        </div>

        {/* Lines */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 3 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 20, textAlign: "center" }}>#</th>
              <th style={th}>Item</th>
              {/* Wide enough for "12 pcs" on ONE line. Wrapping the unit under
                  the number cost ten pixels a row, which is what pushed the
                  balance off the bottom of the label. */}
              <th style={{ ...th, width: 58, textAlign: "right" }}>Qty</th>
              <th style={{ ...th, width: 70, textAlign: "right" }}>Price</th>
              {gstOn && <th style={{ ...th, width: 38, textAlign: "right" }}>GST%</th>}
              <th style={{ ...th, width: 84, textAlign: "right" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lineItems.map((l, i) => {
              const taxable = l.qty * l.price * (1 - l.discountPct / 100);
              const gstAmt = gstOn ? taxable * (l.gstRate / 100) : 0;
              return (
                <tr key={l.id}>
                  <td style={{ ...cell, textAlign: "center" }}>{i + 1}</td>
                  <td style={cell}>
                    {l.name}
                    {l.discountPct > 0 && (
                      <span style={{ fontSize: FONT.caption }}> (-{l.discountPct}%)</span>
                    )}
                  </td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                    {l.qty}
                    {l.unit ? ` ${l.unit}` : ""}
                  </td>
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                    {fmtMoney(l.price)}
                  </td>
                  {gstOn && <td style={{ ...cell, textAlign: "right" }}>{l.gstRate}%</td>}
                  <td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
                    {fmtMoney(taxable + gstAmt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Words on the left, money on the right — the totals stack is kept
          with the signature so a page break can't strand one from the other. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
            // Pushed to the foot of the sheet by the flex column above.
            marginTop: "auto",
            paddingTop: 4,
            breakInside: "avoid",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FONT.words, fontStyle: "italic", lineHeight: 1.3 }}>
              {amountInWords(inv.total)}
            </div>
            <div style={{ fontSize: FONT.footMeta, marginTop: 3 }}>
              Items {inv.lineItems.length} · Qty {r2(totalQty)}
              {gstOn && rates.length > 0 && <> · GST {rates.map((r) => `${r}%`).join(", ")}</>}
            </div>
            <div style={{ marginTop: 10, fontSize: FONT.footMeta, textAlign: "right" }}>
              <div style={{ borderTop: "1px solid #000", display: "inline-block", paddingTop: 2 }}>
                For {company.name || "Company"}
              </div>
            </div>
          </div>

          <div style={{ width: 196, border: "1px solid #000" }}>
            {tot(gstOn ? "Taxable" : "Subtotal", fmtMoney(taxableTotal))}
            {inv.discount > 0 && tot("Discount", `- ${fmtMoney(inv.discount)}`)}
            {gstOn && tot("GST", fmtMoney(gstTotal))}
            {!!inv.shippingCharge && inv.shippingCharge > 0 && (
              <>{tot("Shipping", fmtMoney(inv.shippingCharge))}</>
            )}
            {!!inv.roundOff && Math.abs(inv.roundOff) > 0.001 && (
              <>
                {tot(
                  "Round Off",
                  `${inv.roundOff > 0 ? "+" : "−"} ${fmtMoney(Math.abs(inv.roundOff))}`,
                )}
              </>
            )}
            {tot("TOTAL", fmtMoney(inv.total), true)}
            {inv.paid > 0 && tot("Paid", fmtMoney(inv.paid))}
            {Math.abs(balance) > 0.001 &&
              tot(balance > 0 ? "Balance Due" : "Refundable", fmtMoney(Math.abs(balance)))}
          </div>
        </div>
      </div>
    </div>
  );
}
