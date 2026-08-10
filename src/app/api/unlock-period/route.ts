import { NextResponse, type NextRequest } from "next/server";
import {
  applyLockToTransactions,
  listLockPeriods,
  recordLockHistory,
  setPeriodLock,
} from "@/db/repositories/lock-period-repository";
import { recordUnlockDecision } from "@/db/repositories/unlock-request-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildPeriodLocks } from "@/lib/mock/lock-period";

export const dynamic = "force-dynamic";

/**
 * GET /api/unlock-period?projectId=&locationId=
 *
 * Lists currently locked periods for the Unlock Period page. Restricted to
 * Leader/Super Admin — a Site Admin cannot browse the portfolio of locked
 * periods to unlock. Falls back to the config-derived mock lock schedule
 * (locked periods only) when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const isLeader = persona.role === "super_admin" || persona.role === "leader_admin";
  if (!isLeader) {
    return NextResponse.json(
      { error: "Daftar periode terkunci hanya untuk Leader/Super Admin.", role: persona.role },
      { status: 403 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;

  try {
    const rows = (
      await listLockPeriods({ projectId, locationId, locked: true, scope: "executive" })
    ).filter((r) => canAccessLocation(persona, r.locationId, r.projectId));
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({ source: "db", count: rows.length, periods: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    const periods = buildPeriodLocks(sites).filter((p) => p.state === "locked");
    return NextResponse.json({ source: "mock", count: periods.length, periods });
  }
}

/**
 * POST /api/unlock-period
 * Body: { projectId, locationId, periodLabel, reason, periodStart?, periodEnd? }
 *
 * Unlocks a period and records the action: it clears the lock, cascades the
 * change to the period's transactions, appends a "unlock" entry to the
 * period-lock history, logs an approved unlock request (who reopened it and
 * why), and writes an activity/audit entry. Restricted to Leader/Super Admin.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const isLeader = persona.role === "super_admin" || persona.role === "leader_admin";
  if (!isLeader) {
    return NextResponse.json(
      { error: "Membuka kunci periode hanya untuk Leader/Super Admin.", role: persona.role },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const periodLabel = typeof body.periodLabel === "string" ? body.periodLabel : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  let periodStart = typeof body.periodStart === "string" ? body.periodStart : undefined;
  let periodEnd = typeof body.periodEnd === "string" ? body.periodEnd : undefined;

  // Derive month bounds from a YYYY-MM period label when explicit bounds are not
  // supplied, so the unlock reliably cascades the status update to the period's
  // transactions (locked → submitted).
  if ((!periodStart || !periodEnd) && /^\d{4}-\d{2}$/.test(periodLabel)) {
    const [y, m] = periodLabel.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0)); // last day of the month
    periodStart = periodStart ?? start.toISOString().slice(0, 10);
    periodEnd = periodEnd ?? end.toISOString().slice(0, 10);
  }

  if (!projectId || !locationId || !periodLabel) {
    return NextResponse.json(
      { error: "projectId, locationId, dan periodLabel wajib diisi." },
      { status: 400 },
    );
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: "reason (alasan) minimal 3 karakter." }, { status: 422 });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    const lock = await setPeriodLock({
      projectId,
      locationId,
      periodLabel,
      periodStart,
      periodEnd,
      locked: false,
      actor: persona.name,
      reason,
    });
    const affected = await applyLockToTransactions({
      projectId,
      locationId,
      from: periodStart,
      to: periodEnd,
      locked: false,
    });
    // Period-lock history + approved unlock request + activity audit.
    try {
      await recordLockHistory({ projectId, locationId, periodLabel, action: "unlock", actor: persona.name, reason });
    } catch {
      /* best-effort */
    }
    let request = null;
    try {
      request = await recordUnlockDecision({
        projectId,
        locationId,
        periodLabel,
        status: "approved",
        requestedBy: persona.name,
        reason,
        reviewedBy: persona.name,
        reviewNote: "Dibuka langsung oleh Leader/Super Admin.",
      });
    } catch {
      /* best-effort */
    }
    try {
      await writeAuditLog({
        projectId,
        locationId,
        category: "unlock_period",
        action: "unlock",
        actor: persona.name,
        entityType: "lock_period",
        entityId: periodLabel,
        detail: `Periode ${periodLabel} dibuka — ${reason}. ${affected} transaksi dikembalikan ke status submitted.`,
      });
    } catch {
      /* best-effort */
    }
    revalidateKpi();
    return NextResponse.json({ source: "db", lock, request, affectedTransactions: affected });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json(
      {
        source: "mock",
        simulated: true,
        message: "Periode dibuka secara simulasi (database tidak tersedia).",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
