import { NextResponse, type NextRequest } from "next/server";
import { createDailySubmission } from "@/db/repositories/daily-transaction-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";
import { prepareDailyCostSubmission } from "@/lib/server/services/daily-cost-submission-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/daily-cost/submit
 * Body: { projectId, locationId, trxDate, area?, values: { categoryKey: amount } }
 *
 * Submits a daily cost entry for a site. Validates per-project categories,
 * computes totals and the H+1 late flag, persists header + lines as "submitted",
 * and revalidates the KPI cache so figures refresh. A Site Admin may only submit
 * for a site within their scope; viewers cannot submit.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat submit daily cost." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  const trxDate = typeof body.trxDate === "string" ? body.trxDate : "";
  const area = typeof body.area === "string" ? body.area : undefined;
  const values =
    body.values && typeof body.values === "object" ? (body.values as Record<string, number>) : {};

  if (!projectId || !locationId || !trxDate) {
    return NextResponse.json(
      { error: "projectId, locationId, dan trxDate wajib diisi." },
      { status: 400 },
    );
  }

  // Scope: must be a project/location the persona owns.
  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const prepared = prepareDailyCostSubmission({
    projectId,
    locationId,
    trxDate,
    area,
    values,
    submittedBy: persona.name,
  });
  if (!prepared.ok) {
    return NextResponse.json({ error: "Validasi gagal.", errors: prepared.errors }, { status: 422 });
  }

  try {
    const header = await createDailySubmission(prepared.input);
    revalidateKpi();
    return NextResponse.json({ source: "db", submission: header, isLate: prepared.isLate }, { status: 201 });
  } catch (err) {
    // No live database: acknowledge as a simulated submission and refresh caches.
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Daily cost dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      submission: prepared.input,
      isLate: prepared.isLate,
    });
  }
}
