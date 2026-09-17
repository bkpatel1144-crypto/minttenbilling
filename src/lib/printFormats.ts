import type { PrintFormat } from "@/types";

/**
 * The paper sizes a bill can be printed on, named once.
 *
 * Settings picks the shop default from this list and the invoice page offers
 * the same list as per-bill pills, so a format can never exist in one place
 * and not the other — which is how a shop ends up able to set a default it
 * then cannot see.
 */
export const PRINT_FORMATS: { value: PrintFormat; label: string; hint: string }[] = [
  { value: "a4", label: "A4", hint: "Full-page invoice on ordinary A4 paper" },
  { value: "a4-2up", label: "2 Copies", hint: "Two copies side by side on one landscape A4" },
  { value: "6x4", label: "6x4 in", hint: "6 x 4 inch label stock — compact one-sheet bill" },
  { value: "thermal80", label: "80mm", hint: "80mm thermal receipt roll" },
  { value: "thermal58", label: "58mm", hint: "58mm thermal receipt roll" },
];

/** The 6x4 label, in mm — a real sheet with a bottom edge, so the PDF
 * renderer is given both dimensions rather than measuring the content. */
export const SHEET_6X4_MM = { width: 152.4, height: 101.6 };

/** Paper size to hand the PDF renderer, or undefined for plain A4.
 * A roll sends only a width (it is cut where the bill ends); the 6x4 label
 * sends both. */
export function sheetSizeMm(fmt: PrintFormat): { width?: number; height?: number } {
  if (fmt === "thermal80") return { width: 80 };
  if (fmt === "thermal58") return { width: 58 };
  if (fmt === "6x4") return { width: SHEET_6X4_MM.width, height: SHEET_6X4_MM.height };
  return {};
}

/** Formats printed across the long edge of the paper. */
export function isLandscape(fmt: PrintFormat): boolean {
  return fmt === "a4-2up" || fmt === "6x4";
}
