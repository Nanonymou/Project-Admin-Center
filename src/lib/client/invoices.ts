import type { OutstandingInvoice } from "@/lib/mock/outstanding";
import type { MockInvoice } from "@/lib/mock/site-detail";
import { SITE_KPI } from "@/lib/mock/site-kpi";

/** A DB invoice row as returned by GET /api/invoices. */
export type DbInvoice = {
  id: string;
  number: string;
  projectId: string;
  locationId: string;
  amount: number | string;
  status: string; // "on_time" | "at_risk" | "overdue" | "settled"
  stage: string;
  agingBucket: string; // "0-30" | "31-60" | "61-90" | ">90"
  dueDate: string | null;
  pic: string | null;
};

/** Map the DB invoice status enum to the client's InvoiceStatus. */
function mapStatus(status: string): MockInvoice["status"] {
  if (status === "overdue") return "overdue";
  if (status === "at_risk") return "atRisk";
  return "onTime"; // on_time / settled
}

/** Map a DB invoice row to the client `OutstandingInvoice` shape. */
export function mapDbInvoice(inv: DbInvoice): OutstandingInvoice {
  const site = SITE_KPI.find((s) => s.locationId === inv.locationId);
  return {
    id: inv.id,
    invoiceNumber: inv.number,
    amount: Number(inv.amount) || 0,
    projectCode: inv.projectId,
    locationId: inv.locationId,
    locationName: site?.locationName ?? inv.locationId,
    stage: inv.stage,
    status: mapStatus(inv.status),
    agingBucket: inv.agingBucket as MockInvoice["agingBucket"],
    dueDate: inv.dueDate ?? "",
    pic: inv.pic ?? "-",
  };
}

/**
 * Fetch invoices from the DB and return the outstanding ones (not settled) as
 * `OutstandingInvoice[]`, or `null` when the DB has no invoice data (so callers
 * fall back to the config view). `headers` carries the persona identity.
 */
export async function loadOutstandingFromDb(headers: HeadersInit): Promise<OutstandingInvoice[] | null> {
  try {
    const res = await fetch("/api/invoices?scope=executive", { headers, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { source?: string; invoices?: DbInvoice[] };
    if (data.source !== "db" || !Array.isArray(data.invoices) || data.invoices.length === 0) return null;
    return data.invoices.filter((i) => i.status !== "settled").map(mapDbInvoice);
  } catch {
    return null;
  }
}
