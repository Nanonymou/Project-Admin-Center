import type { MockInvoice, SiteDetail } from "./site-detail";
import type { SiteKpi } from "./site-kpi";

export type OutstandingInvoice = {
  id: string;
  invoiceNumber: string;
  amount: number;
  projectCode: string;
  locationId: string;
  locationName: string;
  stage: string;
  status: MockInvoice["status"];
  agingBucket: MockInvoice["agingBucket"];
  dueDate: string;
  pic: string;
};

export type OutstandingSummary = {
  totalAmount: number;
  totalCount: number;
  byBucket: Record<MockInvoice["agingBucket"], { count: number; amount: number }>;
  byProject: Record<string, { count: number; amount: number }>;
};

/**
 * Configuration-driven: outstanding = any invoice not in the Payment
 * stage (i.e. not yet settled) OR any invoice that is overdue. Derived
 * per site from that site's mock invoice list.
 */
export function buildOutstandingInvoicesFor(
  sites: SiteKpi[],
  detailMap: Record<string, SiteDetail>,
): OutstandingInvoice[] {
  const out: OutstandingInvoice[] = [];
  for (const site of sites) {
    const detail = detailMap[site.locationId];
    if (!detail) continue;
    detail.invoices
      .filter((inv) => inv.stage !== "Payment" || inv.status === "overdue")
      .forEach((inv) => {
        out.push({
          id: `${site.locationId}-${inv.number}`,
          invoiceNumber: inv.number,
          amount: inv.amount,
          projectCode: site.projectCode,
          locationId: site.locationId,
          locationName: site.locationName,
          stage: inv.stage,
          status: inv.status,
          agingBucket: inv.agingBucket,
          dueDate: inv.dueDate,
          pic: inv.pic,
        });
      });
  }
  const bucketOrder = ["0-30", "31-60", "61-90", ">90"] as const;
  out.sort((a, b) => {
    const ia = bucketOrder.indexOf(a.agingBucket);
    const ib = bucketOrder.indexOf(b.agingBucket);
    if (ia !== ib) return ib - ia;
    return b.amount - a.amount;
  });
  return out;
}

export function summarizeOutstanding(items: OutstandingInvoice[]): OutstandingSummary {
  const byBucket: OutstandingSummary["byBucket"] = {
    "0-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "61-90": { count: 0, amount: 0 },
    ">90": { count: 0, amount: 0 },
  };
  const byProject: OutstandingSummary["byProject"] = {};
  let totalAmount = 0;
  for (const item of items) {
    totalAmount += item.amount;
    byBucket[item.agingBucket].count += 1;
    byBucket[item.agingBucket].amount += item.amount;
    if (!byProject[item.projectCode]) byProject[item.projectCode] = { count: 0, amount: 0 };
    byProject[item.projectCode].count += 1;
    byProject[item.projectCode].amount += item.amount;
  }
  return { totalAmount, totalCount: items.length, byBucket, byProject };
}
