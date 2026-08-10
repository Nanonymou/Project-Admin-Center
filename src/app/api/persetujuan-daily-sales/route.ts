import { NextResponse, type NextRequest } from "next/server";
import { listDailySubmissionsBatch } from "@/db/repositories/daily-submission-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { buildDailySalesSubmissions } from "@/lib/mock/daily-sales-approval";

export const dynamic = "force-dynamic";

/**
 * GET /api/persetujuan-daily-sales?projectId=&locationId=&status=&scope=
 *
 * Lists Daily Sales submissions for approval, scoped to the persona. Executive
 * (cross-site) access is restricted to Leader/Super Admin. Falls back to the
 * mock submission list when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
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
  const authz = authorizeDashboard(persona, { projectId, locationId, scope });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (
      await listDailySubmissionsBatch({ projectId, locationId, kind: "sales", status, scope })
    ).filter((r) => canAccessLocation(persona, r.locationId, r.projectId));
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({ source: "db", count: rows.length, submissions: rows });
  } catch {
    let mock = buildDailySalesSubmissions().filter((s) =>
      canAccessLocation(persona, s.locationId, s.projectCode),
    );
    if (projectId) mock = mock.filter((s) => s.projectCode === projectId);
    if (locationId) mock = mock.filter((s) => s.locationId === locationId);
    if (status) mock = mock.filter((s) => s.status === status);
    return NextResponse.json({ source: "mock", count: mock.length, submissions: mock });
  }
}
