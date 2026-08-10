import { NextResponse, type NextRequest } from "next/server";
import {
  listEntryChangeHistory,
  type EntryChangeFilter,
} from "@/db/repositories/entry-change-history-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { buildCostChangeLog } from "@/lib/mock/cost-change-log";
import { buildSalesTransactions } from "@/lib/mock/sales-change-log";

export const dynamic = "force-dynamic";

type ChangeRow = {
  kind: "sales" | "cost";
  transactionId: string | null;
  trxDate: string;
  categoryKey: string | null;
  action: string;
  field: string;
  beforeValue: number | null;
  afterValue: number | null;
  editor: string | null;
  reason: string | null;
  at: string;
};

/**
 * GET /api/entry-change-history?projectId=&locationId=&kind=&transactionId=&trxDate=
 *
 * Returns the field-level change history for daily entries (cost or sales),
 * scoped to the persona. Intended for the per-transaction "Riwayat" view — pass
 * `transactionId` to fetch one entry's trail. Falls back to config/mock change
 * data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const kindRaw = sp.get("kind");
  const kind = kindRaw === "sales" || kindRaw === "cost" ? kindRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: EntryChangeFilter = {
    projectId,
    locationId,
    kind,
    transactionId: sp.get("transactionId") ?? undefined,
    trxDate: sp.get("trxDate") ?? undefined,
    scope,
  };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const rows = (await listEntryChangeHistory(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    if (rows.length === 0 && !filter.transactionId) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      history: rows.map(
        (r): ChangeRow => ({
          kind: r.kind,
          transactionId: r.transactionId,
          trxDate: r.trxDate,
          categoryKey: r.categoryKey,
          action: r.action,
          field: r.field,
          beforeValue: r.beforeValue !== null ? Number(r.beforeValue) : null,
          afterValue: r.afterValue !== null ? Number(r.afterValue) : null,
          editor: r.editor,
          reason: r.reason,
          at: r.createdAt.toISOString(),
        }),
      ),
    });
  } catch {
    // Config/mock fallback derived from the change-log mocks.
    const history: ChangeRow[] = [];
    if (kind !== "sales") {
      for (const c of buildCostChangeLog()) {
        if (!canAccessLocation(persona, c.locationId, c.projectCode)) continue;
        if (projectId && c.projectCode !== projectId) continue;
        if (locationId && c.locationId !== locationId) continue;
        history.push({
          kind: "cost",
          transactionId: null,
          trxDate: c.trxDate,
          categoryKey: null,
          action: c.action,
          field: "amount",
          beforeValue: c.before,
          afterValue: c.after,
          editor: c.editor,
          reason: c.reason ?? null,
          at: c.at,
        });
      }
    }
    if (kind !== "cost") {
      for (const t of buildSalesTransactions()) {
        if (!canAccessLocation(persona, t.locationId, t.projectCode)) continue;
        if (projectId && t.projectCode !== projectId) continue;
        if (locationId && t.locationId !== locationId) continue;
        for (const h of t.history) {
          history.push({
            kind: "sales",
            transactionId: t.id,
            trxDate: t.trxDate,
            categoryKey: t.categoryLabel,
            action: h.action,
            field: h.field,
            beforeValue: h.before !== null ? Number(h.before) : null,
            afterValue: h.after !== null ? Number(h.after) : null,
            editor: h.editor,
            reason: null,
            at: h.at,
          });
        }
      }
    }
    history.sort((a, b) => (a.at < b.at ? 1 : -1));
    return NextResponse.json({ source: "mock", count: history.length, history });
  }
}
