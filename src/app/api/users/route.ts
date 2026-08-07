import { NextResponse, type NextRequest } from "next/server";
import { latestActivityPerPersona } from "@/db/repositories/monitoring-repository";
import { requirePersona } from "@/lib/server/rbac";
import { PERSONAS } from "@/lib/personas";
import { buildUsers } from "@/lib/mock/user-monitoring";

export const dynamic = "force-dynamic";

/** Derive a status from how long ago the user was last seen. */
function statusFor(lastSeen?: string): "active" | "idle" | "offline" {
  if (!lastSeen) return "offline";
  const ms = Date.now() - new Date(lastSeen).getTime();
  if (Number.isNaN(ms)) return "offline";
  if (ms < 15 * 60_000) return "active";
  if (ms < 2 * 60 * 60_000) return "idle";
  return "offline";
}

/**
 * GET /api/users
 * Lists users (personas) with their current status derived from the latest
 * recorded activity. Administrative view restricted to Leader/Super Admin. Falls
 * back to mock monitored users when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Monitoring user hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  try {
    const activity = await latestActivityPerPersona();
    const byPersona = new Map(activity.map((a) => [a.personaId, a]));
    const users = PERSONAS.map((p) => {
      const a = byPersona.get(p.id);
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        roleLabel: p.roleLabel,
        lastSeen: a?.lastSeen ?? null,
        lastAction: a?.lastAction ?? null,
        activityCount: a?.count ?? 0,
        status: statusFor(a?.lastSeen),
      };
    });
    return NextResponse.json({ source: "db", count: users.length, users });
  } catch {
    const users = buildUsers(PERSONAS.length + 6);
    return NextResponse.json({ source: "mock", count: users.length, users });
  }
}
