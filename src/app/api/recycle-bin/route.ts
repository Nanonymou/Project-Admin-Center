import { NextResponse, type NextRequest } from "next/server";
import {
  listDeletedTransactions,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { listDeletedInvoices, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { buildDeletedItems } from "@/lib/mock/recycle-bin";

export const dynamic = "force-dynamic";

/**
 * GET /api/recycle-bin?projectId=&locationId=&type=&scope=
 * Lists soft-deleted (recycled) records — daily sales/cost transactions and
 * invoices — scoped to the persona, with an optional `type` filter
 * (daily_sales|daily_cost|invoice). Cross-site (executive) access is restricted
 * to Leader/Super Admin. Falls back to mock recycle-bin items when the DB is
 * unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const type = sp.get("type") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, { projectId, locationId, scope });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  const dtFilter: DashboardFilter = { projectId, locationId, scope };
  const invFilter: InvoiceFilter = { projectId, locationId, scope };

  try {
    const items: Array<Record<string, unknown>> = [];

    if (!type || type === "daily_sales" || type === "daily_cost") {
      const trx = (await listDeletedTransactions(dtFilter)).filter((r) =>
        canAccessLocation(persona, r.locationId, r.projectId),
      );
      for (const t of trx) {
        const itemType = t.kind === "sales" ? "daily_sales" : "daily_cost";
        if (type && type !== itemType) continue;
        items.push({
          id: t.id,
          type: itemType,
          projectCode: t.projectId,
          locationId: t.locationId,
          label: `${itemType === "daily_sales" ? "Daily Sales" : "Daily Cost"} ${t.trxDate}`,
          amount: Number(t.total),
          deletedAt: t.deletedAt,
          deletedBy: t.deletedBy,
        });
      }
    }

    if (!type || type === "invoice") {
      const inv = (await listDeletedInvoices(invFilter)).filter((r) =>
        canAccessLocation(persona, r.locationId, r.projectId),
      );
      for (const i of inv) {
        items.push({
          id: i.id,
          type: "invoice",
          projectCode: i.projectId,
          locationId: i.locationId,
          label: `Invoice ${i.number}`,
          amount: Number(i.amount),
          deletedAt: i.deletedAt,
          deletedBy: i.deletedBy,
        });
      }
    }

    items.sort((a, b) => String(b.deletedAt ?? "").localeCompare(String(a.deletedAt ?? "")));
    return NextResponse.json({ source: "db", filter: { projectId, locationId, type, scope }, count: items.length, items });
  } catch {
    let items = buildDeletedItems(14);
    if (type) items = items.filter((i) => i.type === type);
    return NextResponse.json({ source: "mock", filter: { projectId, locationId, type, scope }, count: items.length, items });
  }
}
