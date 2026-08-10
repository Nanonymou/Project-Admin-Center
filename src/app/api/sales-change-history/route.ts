import { NextResponse, type NextRequest } from "next/server";
import { listEntryChangeHistory } from "@/db/repositories/entry-change-history-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { buildSalesTransactions } from "@/lib/mock/sales-change-log";

export const dynamic = "force-dynamic";

type ChangeRow = {
  transactionId: string | null;
  trxDate: string;
  categoryLabel: string | null;
  action: string;
  field: string;
  before: string | null;
  after: string | null;
  editor: string | null;
  at: string;
};

/**
 * GET /api/sales-change-history?projectId=&locationId=&transactionId=&trxDate=
 *
 * Returns the sales-side change history for the "Riwayat Perubahan Penjualan"
 * page — the create/update trail per transaction. Reads the sales rows of the
 * generic entry change history (kind = sales); pass `transactionId` for one
 * transaction's trail. Falls back to the mock sales transactions' embedded
 * history when the database is unavailable. Persona-scoped.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const transactionId = sp.get("transactionId") ?? undefined;
  const trxDate = sp.get("trxDate") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const rows = (
      await listEntryChangeHistory({ projectId, locationId, kind: "sales", transactionId, trxDate, scope })
    ).filter((r) => canAccessLocation(persona, r.locationId, r.projectId));
    if (rows.length === 0 && !transactionId) throw new Error("empty");
    const history: ChangeRow[] = rows.map((r) => ({
      transactionId: r.transactionId,
      trxDate: r.trxDate,
      categoryLabel: r.categoryKey,
      action: r.action,
      field: r.field,
      before: r.beforeValue !== null ? String(Number(r.beforeValue)) : null,
      after: r.afterValue !== null ? String(Number(r.afterValue)) : null,
      editor: r.editor,
      at: r.createdAt.toISOString(),
    }));
    return NextResponse.json({ source: "db", count: history.length, history });
  } catch {
    let txns = buildSalesTransactions().filter((t) =>
      canAccessLocation(persona, t.locationId, t.projectCode),
    );
    if (projectId) txns = txns.filter((t) => t.projectCode === projectId);
    if (locationId) txns = txns.filter((t) => t.locationId === locationId);
    if (transactionId) txns = txns.filter((t) => t.id === transactionId);
    const history: ChangeRow[] = txns.flatMap((t) =>
      t.history.map((h) => ({
        transactionId: t.id,
        trxDate: t.trxDate,
        categoryLabel: t.categoryLabel,
        action: h.action,
        field: h.field,
        before: h.before,
        after: h.after,
        editor: h.editor,
        at: h.at,
      })),
    );
    history.sort((a, b) => (a.at < b.at ? 1 : -1));
    return NextResponse.json({ source: "mock", count: history.length, history });
  }
}
