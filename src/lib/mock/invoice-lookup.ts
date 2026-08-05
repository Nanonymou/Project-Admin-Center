import { SITE_DETAILS, type MockInvoice, type SiteDetail } from "./site-detail";

export type InvoiceLookupResult = {
  invoice: MockInvoice;
  detail: SiteDetail;
};

/**
 * Turn an invoice number like "INV/2026/08/BUMA/0001" into a URL slug —
 * "/" is unsafe in Next.js dynamic segments even URL-encoded on some hosts,
 * so we substitute a marker character.
 */
export function invoiceToSlug(invoiceNumber: string): string {
  return encodeURIComponent(invoiceNumber.replace(/\//g, "__"));
}

export function slugToInvoiceNumber(slug: string): string {
  return decodeURIComponent(slug).replace(/__/g, "/");
}

export function invoiceHref(invoiceNumber: string): string {
  return `/invoice/${invoiceToSlug(invoiceNumber)}`;
}

export function findInvoiceByNumber(invoiceNumber: string): InvoiceLookupResult | undefined {
  for (const detail of Object.values(SITE_DETAILS)) {
    const invoice = detail.invoices.find((i) => i.number === invoiceNumber);
    if (invoice) return { invoice, detail };
  }
  return undefined;
}
