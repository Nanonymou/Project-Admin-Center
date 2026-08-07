import { NextResponse, type NextRequest } from "next/server";
import { latestActivityPerPersona, writeUserActivity } from "@/db/repositories/monitoring-repository";
import { requirePersona } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/** Presence window: a persona seen within this many ms counts as online. */
const ONLINE_WINDOW_MS = 5 * 60_000;

/**
 * POST /api/presence
 * Body: { action?, projectId?, locationId? }
 *
 * Heartbeat that records the calling persona's presence (an activity row) so the
 * User Monitoring view reflects who is online in near real time. Any
 * authenticated persona may report its own presence. Returns the current online
 * persona ids for convenience.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine — a bare heartbeat.
  }

  const action = typeof body.action === "string" ? body.action : "heartbeat";
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const locationId = typeof body.locationId === "string" ? body.locationId : undefined;
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  try {
    await writeUserActivity({
      personaId: persona.id,
      actorName: persona.name,
      role: persona.role,
      action,
      projectId,
      locationId,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ? userAgent.slice(0, 256) : undefined,
    });

    const activity = await latestActivityPerPersona();
    const now = Date.now();
    const online = activity
      .filter((a) => now - new Date(a.lastSeen).getTime() < ONLINE_WINDOW_MS)
      .map((a) => a.personaId);
    return NextResponse.json({ source: "db", ok: true, personaId: persona.id, online });
  } catch (err) {
    return NextResponse.json({
      source: "mock",
      simulated: true,
      ok: true,
      personaId: persona.id,
      online: [persona.id],
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * GET /api/presence — returns the persona ids currently online (seen within the
 * presence window). Requires authentication.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const activity = await latestActivityPerPersona();
    const now = Date.now();
    const online = activity
      .filter((a) => now - new Date(a.lastSeen).getTime() < ONLINE_WINDOW_MS)
      .map((a) => ({ personaId: a.personaId, lastSeen: a.lastSeen }));
    return NextResponse.json({ source: "db", online });
  } catch {
    return NextResponse.json({ source: "mock", online: [] });
  }
}
