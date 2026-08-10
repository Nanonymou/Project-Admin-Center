import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { buildSubmitCostReminders } from "@/lib/server/services/submit-cost-reminder-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/submit-daily-cost/reminders?date=&projectId=
 *
 * Runs the automatic Submit Daily Cost reminder check for a date (default today)
 * and returns a reminder per site that has not yet submitted its Daily Cost,
 * scoped to the persona. Intended to be polled by the UI or a scheduled job.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const date = sp.get("date") ?? today;
  const projectId = sp.get("projectId") ?? undefined;

  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const result = await buildSubmitCostReminders(persona, date, projectId);
  return NextResponse.json(result);
}
