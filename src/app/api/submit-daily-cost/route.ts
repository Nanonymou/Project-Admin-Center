import { NextResponse, type NextRequest } from "next/server";
import {
  submitDailyBatch,
  listDailySubmissionsBatch,
} from "@/db/repositories/daily-submission-repository";
import {
  aggregateByCategory,
  countTransactionsForDate,
  type DashboardFilter,
} from "@/db/repositories/daily-transaction-repository";
import { setPeriodLock } from "@/db/repositories/lock-period-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/submit-daily-cost?projectId=&locationId=&status=
 * Lists Daily Cost batch submissions for the persona's scope.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const statusRaw = sp.get("status");
  const status =
    statusRaw === "draft" ||
    statusRaw === "submitted" ||
    statusRaw === "reviewed" ||
    statusRaw === "approved" ||
    statusRaw === "rejected"
      ? statusRaw
      : undefined;

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const rows = (
      await listDailySubmissionsBatch({
        projectId,
        locationId: sp.get("locationId") ?? undefined,
        kind: "cost",
        status,
        scope,
      })
    ).filter((r) => canAccessLocation(persona, r.locationId, r.projectId));
    return NextResponse.json({ source: "db", count: rows.length, submissions: rows });
  } catch {
    return NextResponse.json({ source: "mock", count: 0, submissions: [] });
  }
}

/**
 * POST /api/submit-daily-cost
 * Body: { projectId, locationId, submissionDate, lock? }
 *
 * Aggregates the day's Daily Cost entries, records a submitted batch, and — when
 * `lock` is true — locks that day's period so the data can no longer be edited.
 * Restricted to personas with tenant access to the site; viewers cannot submit.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat submit." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const submissionDate = typeof body.submissionDate === "string" ? body.submissionDate : "";
  const lock = body.lock === true;

  if (!projectId || !locationId || !DATE_RE.test(submissionDate)) {
    return NextResponse.json(
      { error: "projectId, locationId, dan submissionDate (YYYY-MM-DD) wajib diisi." },
      { status: 400 },
    );
  }
  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  try {
    const filter: DashboardFilter = {
      projectId,
      locationId,
      from: submissionDate,
      to: submissionDate,
      scope: "tenant",
    };
    const categories = await aggregateByCategory(filter, "cost");
    const total = categories.reduce((s, c) => s + c.amount, 0);
    const entryCount = await countTransactionsForDate(projectId, locationId, "cost", submissionDate);
    if (entryCount === 0) {
      return NextResponse.json(
        { error: "Tidak ada entri Daily Cost untuk tanggal ini." },
        { status: 404 },
      );
    }

    const submission = await submitDailyBatch({
      projectId,
      locationId,
      kind: "cost",
      submissionDate,
      totalAmount: total.toFixed(2),
      entryCount,
      submittedBy: persona.name,
    });

    let locked = false;
    if (lock) {
      await setPeriodLock({
        projectId,
        locationId,
        periodLabel: submissionDate,
        periodStart: submissionDate,
        periodEnd: submissionDate,
        locked: true,
        actor: persona.name,
        reason: "Dikunci saat submit Daily Cost.",
      });
      locked = true;
    }

    try {
      await writeAuditLog({
        projectId,
        locationId,
        category: "daily_cost",
        action: lock ? "submit_lock" : "submit",
        actor: persona.name,
        entityType: "daily_submission",
        entityId: submission.id,
        detail: `Submit Daily Cost ${submissionDate}: ${entryCount} entri, total ${total}.${lock ? " Data dikunci." : ""}`,
      });
    } catch {
      // best-effort
    }

    return NextResponse.json({ source: "db", submission, locked }, { status: 201 });
  } catch {
    return NextResponse.json(
      { source: "mock", simulated: true, message: "Submit tidak tersedia tanpa database." },
      { status: 503 },
    );
  }
}
