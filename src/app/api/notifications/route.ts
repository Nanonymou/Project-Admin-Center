import { NextResponse, type NextRequest } from "next/server";
import { listDeadlines, type DeadlineFilter } from "@/db/repositories/deadline-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildDeadlines } from "@/lib/mock/deadlines";
import {
  summarizeNotifications,
  toDeadlineNotifications,
  type DeadlineNotificationInput,
} from "@/lib/server/services/deadline-notification-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?projectId=&locationId=&kind=&scope=
 * Actionable deadline notifications (due soon / due today / overdue) across the
 * sites the persona may see, ordered most urgent first. Cross-site (executive)
 * access is restricted to Leader/Super Admin. Falls back to mock deadlines when
 * the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const kind = sp.get("kind") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: DeadlineFilter = { projectId, locationId, kind, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listDeadlines(filter)).filter((r) =>
      canAccessLocation(persona, r.locationId, r.projectId),
    );
    const input: DeadlineNotificationInput[] = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      projectCode: r.projectId,
      locationId: r.locationId,
      owner: r.owner ?? undefined,
      dueDate: r.dueDate,
      status: r.status,
    }));
    const notifications = toDeadlineNotifications(input);
    return NextResponse.json({
      source: "db",
      filter,
      summary: summarizeNotifications(notifications),
      notifications,
    });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);

    let items = buildDeadlines(sites);
    if (kind) items = items.filter((i) => i.kind === kind);
    const input: DeadlineNotificationInput[] = items.map((i) => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      projectCode: i.projectCode,
      locationId: i.locationId,
      locationName: i.locationName,
      owner: i.owner,
      dueDate: i.dueDate,
      status: i.status,
    }));
    const notifications = toDeadlineNotifications(input);
    return NextResponse.json({
      source: "mock",
      filter,
      summary: summarizeNotifications(notifications),
      notifications,
    });
  }
}
