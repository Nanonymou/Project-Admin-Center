import { NextResponse, type NextRequest } from "next/server";
import {
  createDailySubmission,
  findLatestTransaction,
  getDailyTransactionById,
  getDailyTransactionWithLines,
  type DailySubmissionInput,
} from "@/db/repositories/daily-transaction-repository";
import { isPeriodLocked } from "@/db/repositories/lock-period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { isInputClosedForDate } from "@/lib/server/services/cutoff-policy-service";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isLateFor(trxDate: string, ref = new Date()): boolean {
  const today = ref.toISOString().slice(0, 10);
  const a = new Date(`${trxDate}T00:00:00Z`).getTime();
  const b = new Date(`${today}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000) > 1;
}

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
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : undefined;
  const kind = body.kind === "cost" ? "cost" : "sales";

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

    const withLines = await getDailyTransactionWithLines(source.id);
    const lines = withLines?.lines ?? [];
    const input: DailySubmissionInput = {
      projectId: source.projectId,
      locationId: source.locationId,
      kind: source.kind,
      trxDate: targetDate,
      area: source.area ?? undefined,
      areaId: source.areaId ?? undefined,
      subtotal: source.subtotal,
      tax: source.tax,
      total: source.total,
      isLate: isLateFor(targetDate),
      submittedBy: persona.name,
      lines: lines.map((l) => ({
        categoryKey: l.categoryKey,
        label: l.label,
        qty: l.qty,
        unitPrice: l.unitPrice,
        amount: l.amount,
        isDeduction: l.isDeduction,
      })),
    };

    const created = await createDailySubmission(input);
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
