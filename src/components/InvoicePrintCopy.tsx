import type { Company, Invoice, PrintFormat } from "@/types";
import { PrintableInvoice } from "@/components/PrintableInvoice";
import { PrintableInvoice6x4 } from "@/components/PrintableInvoice6x4";
import { ThermalReceipt } from "@/components/ThermalReceipt";

/**
 * A bill mounted hidden, in whichever paper size the shop prints on.
 *
 * The create/edit form keeps one of these mounted at all times: it is what
 * Ctrl+P and Save & Print put on paper, without the form having to navigate
 * anywhere to find a printable copy. Every branch renders with the
 * `print-area` class — invisible on screen, the printed page once a print
 * starts (see the @media print rules in styles.css).
 *
 * The bill's own page does NOT use this: it shows the same sheets on screen
 * inside a scaled preview, which needs its own wrappers.
 */
export function InvoicePrintCopy({
  inv,
  company,
  mode,
  format,
}: {
  inv: Invoice;
  company: Company;
  mode: "sale" | "purchase";
  format: PrintFormat;
}) {
  if (format === "thermal80" || format === "thermal58") {
    return (
      <ThermalReceipt
        inv={inv}
        company={company}
        width={format === "thermal80" ? 80 : 58}
        className="print-area"
      />
    );
  }

  if (format === "6x4") {
    return <PrintableInvoice6x4 inv={inv} company={company} mode={mode} className="print-area" />;
  }

  if (format === "a4-2up") {
    return (
      <div className="print-area">
        {/* Same sheet the bill page's "2 Copies" preview prints — landscape
            A4, two copies at the scale that keeps a normal-length bill on
            one page, split by a cut line. */}
        <style>{`@media print {
          @page { size: A4 landscape; margin: 0; }
          .a4-2up-copy { padding: 6mm !important; }
        }`}</style>
        <div className="a4-2up-copy" style={{ display: "flex" }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <PrintableInvoice inv={inv} company={company} mode={mode} className="" scale={0.62} />
          </div>
          <div style={{ borderLeft: "1px dashed #999", margin: "0 4px", flexShrink: 0 }} />
          <div style={{ flex: 1, paddingLeft: 12 }}>
            <PrintableInvoice inv={inv} company={company} mode={mode} className="" scale={0.62} />
          </div>
        </div>
      </div>
    );
  }

  return <PrintableInvoice inv={inv} company={company} mode={mode} className="print-area" />;
}
