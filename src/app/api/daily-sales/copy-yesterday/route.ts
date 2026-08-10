import { NextResponse, type NextRequest } from "next/server";
import {
  findLatestTransaction,
  copyDailyTransaction,
} from "@/db/repositories/daily-transaction-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { validatePeriodInput } from "@/lib/server/guards/period-input-guard";

export const dynamic = "force-dynamic";

/**
 * POST /api/daily-sales/copy-yesterday
 * Body: { projectId, locationId, kind?, targetDate? }
 *
 * Copies the most recent previous entry into a new draft dated `targetDate`
 * (default today). The copy is created server-side with `copied_from_id`
 * provenance and a "copy" change-log entry; input is rejected when the target
 * period is locked or past the H+1 window. Enforces tenant/site access.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const kind = body.kind === "cost" ? "cost" : "sales";
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = typeof body.targetDate === "string" ? body.targetDate : today;

  if (!projectId || !locationId || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json(
      { error: "projectId, locationId, dan targetDate (YYYY-MM-DD) wajib diisi." },
      { status: 400 },
    );
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Cut-off / H+1 guard: cannot write into a closed target period.
  const policy = validatePeriodInput(projectId, targetDate);
  if (!policy.ok) {
    return NextResponse.json({ error: policy.error }, { status: policy.status });
  }

  try {
    const source = await findLatestTransaction(projectId, locationId, kind, targetDate);
    if (!source) {
      return NextResponse.json({ error: "Tidak ada data sebelumnya untuk disalin." }, { status: 404 });
    }
    const copy = await copyDailyTransaction(source.id, targetDate, persona.name);
    if (!copy) {
      return NextResponse.json({ error: "Gagal menyalin data." }, { status: 500 });
    }
    // Activity log: record the copy on the cross-entity audit trail.
    try {
      await writeAuditLog({
        projectId,
        locationId,
        category: "daily_transaction",
        action: "copy",
        actor: persona.name,
        entityType: `daily_${kind}`,
        entityId: copy.id,
        detail: `Salin data ${kind} ${source.trxDate} → ${targetDate} (dari ${source.id}).`,
      });
    } catch {
      // audit trail is best-effort; never fail the copy on log error
    }
    return NextResponse.json({ source: "db", copiedFrom: source.trxDate, transaction: copy }, { status: 201 });
  } catch {
    // Mock fallback: report the intent without persisting.
    return NextResponse.json({
      source: "mock",
      copiedFrom: null,
      transaction: { projectId, locationId, kind, trxDate: targetDate, status: "draft" },
    });
  }
}
