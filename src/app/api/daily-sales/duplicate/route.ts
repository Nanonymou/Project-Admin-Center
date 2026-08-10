import { NextResponse, type NextRequest } from "next/server";
import {
  copyDailyTransaction,
  countTransactionsForDate,
  findLatestTransaction,
  getDailyTransactionById,
} from "@/db/repositories/daily-transaction-repository";
import { isPeriodLocked } from "@/db/repositories/lock-period-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { isInputClosedForDate } from "@/lib/server/services/cutoff-policy-service";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/daily-sales/duplicate
 * Body: { targetDate, sourceId?, projectId?, locationId?, kind? }
 *
 * Duplicates a transaction into `targetDate`. With `sourceId`, copies that
 * entry; otherwise ("salin kemarin") copies the site's most recent entry before
 * targetDate — `projectId`, `locationId` (and optional `kind`) identify the site.
 * The copy is created as a fresh submission. Viewers cannot duplicate; the
 * target period must not be locked.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menduplikasi transaksi." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const targetDate = typeof body.targetDate === "string" ? body.targetDate : "";
  if (!DATE_RE.test(targetDate)) {
    return NextResponse.json({ error: "targetDate (YYYY-MM-DD) wajib diisi." }, { status: 400 });
  }
  // Validation: the target date cannot be in the future.
  const today = new Date().toISOString().slice(0, 10);
  if (targetDate > today) {
    return NextResponse.json({ error: "targetDate tidak boleh di masa depan." }, { status: 422 });
  }
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : undefined;
  const kind = body.kind === "cost" ? "cost" : "sales";
  // `allowDuplicate` overrides the same-date guard when the caller intends it.
  const allowDuplicate = body.allowDuplicate === true;

  try {
    // Resolve the source transaction: explicit id, or the latest prior entry.
    let source = sourceId ? await getDailyTransactionById(sourceId) : null;
    if (sourceId && !source) {
      return NextResponse.json({ error: "Transaksi sumber tidak ditemukan." }, { status: 404 });
    }
    if (!source) {
      const projectId = typeof body.projectId === "string" ? body.projectId : "";
      const locationId = typeof body.locationId === "string" ? body.locationId : "";
      if (!projectId || !locationId) {
        return NextResponse.json(
          { error: "Sertakan sourceId, atau projectId + locationId untuk salin kemarin." },
          { status: 400 },
        );
      }
      source = await findLatestTransaction(projectId, locationId, kind, targetDate);
      if (!source) {
        return NextResponse.json({ error: "Tidak ada transaksi sebelumnya untuk disalin." }, { status: 404 });
      }
    }

    if (!canAccessLocation(persona, source.locationId, source.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke transaksi ini." }, { status: 403 });
    }
    const authz = authorizeDashboard(persona, {
      projectId: source.projectId,
      locationId: source.locationId,
      scope: "tenant",
    });
    if (!authz.ok) {
      return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
    }
    if (await isPeriodLocked(source.projectId, source.locationId, targetDate)) {
      return NextResponse.json({ error: "Periode target terkunci." }, { status: 409 });
    }
    if (isInputClosedForDate(source.projectId, targetDate)) {
      return NextResponse.json(
        { error: "Periode target sudah melewati cut-off — input ditutup." },
        { status: 409 },
      );
    }

    // Validation: refuse to create a second entry for the same date unless the
    // caller explicitly opts in via `allowDuplicate`.
    if (!allowDuplicate) {
      const existing = await countTransactionsForDate(
        source.projectId,
        source.locationId,
        source.kind,
        targetDate,
      );
      if (existing > 0) {
        return NextResponse.json(
          {
            error: `Sudah ada ${existing} entri ${source.kind} untuk ${targetDate}. Sertakan allowDuplicate=true untuk tetap menduplikasi.`,
            existing,
          },
          { status: 409 },
        );
      }
    }

    // Create an editable DRAFT copy with `copied_from_id` provenance and a
    // "copy" change-log entry (see copyDailyTransaction). A draft doesn't affect
    // KPIs until submitted, but revalidate so any draft-aware views refresh.
    const created = await copyDailyTransaction(source.id, targetDate, persona.name);
    if (!created) {
      return NextResponse.json({ error: "Gagal menduplikasi transaksi." }, { status: 500 });
    }
    try {
      await writeAuditLog({
        projectId: source.projectId,
        locationId: source.locationId,
        category: "daily_transaction",
        action: "duplicate",
        actor: persona.name,
        entityType: `daily_${source.kind}`,
        entityId: created.id,
        detail: `Duplikasi entri ${source.trxDate} → ${targetDate} (dari ${source.id}).`,
      });
    } catch {
      // best-effort
    }
    revalidateKpi();
    return NextResponse.json({ source: "db", copiedFrom: source.id, entry: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        source: "mock",
        simulated: true,
        message: "Duplikasi tidak tersedia tanpa database.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
