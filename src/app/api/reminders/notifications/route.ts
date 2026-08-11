import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { buildReminders } from "@/lib/mock/reminders";

export const dynamic = "force-dynamic";

/**
 * GET /api/reminders/notifications?locationId=&level=
 *
 * The persona's current active reminder notifications (cut-off & deadline
 * reminders) across their accessible sites, most-urgent first, optionally
 * narrowed to one location or severity level. Frontend-first: derived from the
 * `reminders` config. Any authenticated persona reads within their scope.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const locationId = sp.get("locationId") ?? undefined;
  const levelRaw = sp.get("level");
  const level = levelRaw === "info" || levelRaw === "warning" || levelRaw === "critical" ? levelRaw : undefined;

  let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  if (locationId) sites = sites.filter((s) => s.locationId === locationId);

  const order = { critical: 0, warning: 1, info: 2 } as const;
  let notifications = sites.flatMap((s) => buildReminders(s));
  if (level) notifications = notifications.filter((n) => n.level === level);
  notifications.sort((a, b) => order[a.level] - order[b.level]);

  const unread = notifications.filter((n) => n.level !== "info").length;

  return NextResponse.json({ source: "config", count: notifications.length, unread, notifications });
}
