import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation, canAccessProject } from "@/lib/personas";
import { listReminderLogs } from "@/db/repositories/reminder-log-repository";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildReminderHistory } from "@/lib/mock/reminders";

export const dynamic = "force-dynamic";

/**
 * GET /api/reminders/history?projectId=&locationId=&limit=
 *
 * The dispatched-reminder history (reminder_logs), newest first, scoped to the
 * persona's accessible sites. Falls back to the config-derived history
 * (`buildReminderHistory`) when the DB is unavailable so the view always renders.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }
  if (locationId && projectId && !canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const accessible = new Set(
    SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode)).map((s) => s.locationId),
  );

  try {
    const rows = (await listReminderLogs({ projectCode: projectId, locationId, limit })).filter(
      (r) => !r.locationId || accessible.has(r.locationId),
    );
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      history: rows.map((r) => ({
        id: r.id,
        level: r.level,
        trigger: r.trigger,
        title: r.title,
        channel: r.channel,
        status: r.status,
        audience: r.audience,
        projectCode: r.projectCode,
        locationId: r.locationId,
        sentAt: r.sentAt,
      })),
    });
  } catch {
    let sites = SITE_KPI.filter((s) => accessible.has(s.locationId));
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    let history = sites.flatMap((s) => buildReminderHistory(s)).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    if (limit) history = history.slice(0, limit);
    return NextResponse.json({ source: "config", count: history.length, history });
  }
}
