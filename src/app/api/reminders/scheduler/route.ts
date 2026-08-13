import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import {
  planCutOffReminders,
  runCutOffReminderScheduler,
} from "@/lib/server/services/reminder-scheduler-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/reminders/scheduler — PREVIEW the cut-off reminders that would fire
 * now (based on data completeness), scoped to the persona's sites. Does not
 * persist. Any authenticated persona may preview their scope.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
  const reminders = planCutOffReminders(sites);
  return NextResponse.json({ preview: true, planned: reminders.length, reminders });
}

/**
 * POST /api/reminders/scheduler — RUN the scheduler: plan the cut-off reminders
 * across all sites and persist them to reminder_logs. This is the entry point a
 * cron/job would call, so it is restricted to Super Admin. Disabled in
 * production without an explicit run flag to avoid accidental dispatch.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin yang dapat menjalankan scheduler." }, { status: 403 });
  }

  const result = await runCutOffReminderScheduler(SITE_KPI);
  return NextResponse.json({ ok: true, ...result });
}
