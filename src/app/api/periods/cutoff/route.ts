import { NextResponse, type NextRequest } from "next/server";
import { setPeriodCutoff } from "@/db/repositories/period-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/periods/cutoff
 * Body: { projectId, locationId, periodLabel, periodEnd, periodStart?, periodType?, note? }
 *
 * Sets or overrides a period's cut-off date (periodEnd) for a site, recording a
 * history entry. Restricted to configure-capable personas within their scope.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json(
      { error: "Hanya Leader/Super Admin yang dapat menetapkan cut-off." },
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
  const periodEnd = typeof body.periodEnd === "string" ? body.periodEnd : "";
  if (!projectId || !locationId || !periodLabel || !DATE_RE.test(periodEnd)) {
    return NextResponse.json(
      { error: "projectId, locationId, periodLabel, dan periodEnd (YYYY-MM-DD) wajib diisi." },
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

  const periodStart = typeof body.periodStart === "string" ? body.periodStart : undefined;
  const periodType = typeof body.periodType === "string" ? body.periodType : undefined;
  const note = typeof body.note === "string" ? body.note : undefined;

  try {
    const period = await setPeriodCutoff({
      projectId,
      locationId,
      periodLabel,
      periodType,
      periodStart,
      periodEnd,
      actor: persona.name,
      note,
    });
    return NextResponse.json({ source: "db", period });
  } catch (err) {
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Cut-off diset secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      period: { projectId, locationId, periodLabel, periodEnd },
    });
  }
}
