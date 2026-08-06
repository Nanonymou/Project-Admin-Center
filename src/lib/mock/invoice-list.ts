import { SITE_DETAILS, type MockInvoice, type SiteDetail } from "./site-detail";
import type { SiteKpi } from "./site-kpi";

/** Settlement lifecycle derived from stage + status, project-agnostic. */
export type InvoiceSettlement = "settled" | "outstanding" | "overdue";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  amount: number;
  projectCode: string;
  locationId: string;
  locationName: string;
  stage: string;
  status: MockInvoice["status"];
  settlement: InvoiceSettlement;
  agingBucket: MockInvoice["agingBucket"];
  dueDate: string;
  pic: string;
};

export type InvoiceListSummary = {
  totalAmount: number;
  totalCount: number;
  bySettlement: Record<InvoiceSettlement, { count: number; amount: number }>;
};

function settlementOf(inv: MockInvoice): InvoiceSettlement {
  if (inv.status === "overdue") return "overdue";
  if (inv.stage === "Payment") return "settled";
  return "outstanding";
}

/**
 * Configuration-driven invoice monitoring feed: flattens every invoice from
 * each accessible site's mock invoice list, regardless of project. Nothing
 * here is keyed to a specific project code — the same engine serves any site.
 */
export function buildInvoiceListFor(
  sites: SiteKpi[],
  detailMap: Record<string, SiteDetail> = SITE_DETAILS,
): InvoiceListItem[] {
  const out: InvoiceListItem[] = [];
  for (const site of sites) {
    const detail = detailMap[site.locationId];
    if (!detail) continue;
    detail.invoices.forEach((inv) => {
      out.push({
        id: `${site.locationId}-${inv.number}`,
        invoiceNumber: inv.number,
        amount: inv.amount,
        projectCode: site.projectCode,
        locationId: site.locationId,
        locationName: site.locationName,
        stage: inv.stage,
        status: inv.status,
        settlement: settlementOf(inv),
        agingBucket: inv.agingBucket,
        dueDate: inv.dueDate,
        pic: inv.pic,
      });
    });
  }
  // Overdue first, then outstanding, then settled; larger amounts on top.
  const order: InvoiceSettlement[] = ["overdue", "outstanding", "settled"];
  out.sort((a, b) => {
    const ia = order.indexOf(a.settlement);
    const ib = order.indexOf(b.settlement);
    if (ia !== ib) return ia - ib;
    return b.amount - a.amount;
  });
  return out;
}

export function summarizeInvoiceList(items: InvoiceListItem[]): InvoiceListSummary {
  const bySettlement: InvoiceListSummary["bySettlement"] = {
    settled: { count: 0, amount: 0 },
    outstanding: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
  };
  let totalAmount = 0;
  for (const item of items) {
    totalAmount += item.amount;
    bySettlement[item.settlement].count += 1;
    bySettlement[item.settlement].amount += item.amount;
  }
  return { totalAmount, totalCount: items.length, bySettlement };
}
