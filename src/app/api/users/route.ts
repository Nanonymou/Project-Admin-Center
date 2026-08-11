import { NextResponse, type NextRequest } from "next/server";
import { latestActivityPerPersona } from "@/db/repositories/monitoring-repository";
import { requirePersona } from "@/lib/server/rbac";
import { PERSONAS } from "@/lib/personas";
import { buildUsers } from "@/lib/mock/user-monitoring";
import { validateRoleAssignable } from "@/lib/server/services/role-assignment-validation-service";
import { enforceActiveRole } from "@/lib/server/services/effective-access-service";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";

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

  // Filters: free-text search (name/role), role, status, and location scope.
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const roleFilter = sp.get("role") ?? undefined;
  const statusFilter = sp.get("status") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;

  const matchesPersona = (p: (typeof PERSONAS)[number]) => {
    if (roleFilter && p.role !== roleFilter) return false;
    if (q && !`${p.name} ${p.roleLabel} ${p.role}`.toLowerCase().includes(q)) return false;
    // Location filter: keep users whose scope covers the location (empty scope =
    // all locations, so they always match).
    if (locationId && p.scope.locations.length > 0 && !p.scope.locations.includes(locationId)) {
      return false;
    }
    return true;
  };

  try {
    const activity = await latestActivityPerPersona();
    const byPersona = new Map(activity.map((a) => [a.personaId, a]));
    const users = PERSONAS.filter(matchesPersona)
      .map((p) => {
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
      })
      .filter((u) => !statusFilter || u.status === statusFilter);
    return NextResponse.json({
      source: "db",
      filter: { q, role: roleFilter, status: statusFilter, locationId },
      count: users.length,
      users,
    });
  } catch {
    let users = buildUsers(PERSONAS.length + 6);
    if (roleFilter) users = users.filter((u) => u.role === roleFilter);
    if (statusFilter) users = users.filter((u) => u.status === statusFilter);
    if (q) users = users.filter((u) => u.name.toLowerCase().includes(q));
    return NextResponse.json({
      source: "mock",
      filter: { q, role: roleFilter, status: statusFilter, locationId },
      count: users.length,
      users,
    });
  }
}

/**
 * POST /api/users — assign/create a user with a role.
 * Body: { name, email, role }.
 *
 * Enforces that the assigned role exists and is ACTIVE — a deactivated role can
 * never be granted to a new user (Role feature guard). Authorization: Leader/
 * Super Admin. The user directory itself is config-backed for now, so this
 * validates and records the assignment rather than persisting a users row.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat menambah user." }, { status: 403 });
  }
  // A caller whose own role was deactivated loses the right to add users.
  const active = await enforceActiveRole(persona);
  if (!active.ok) return NextResponse.json({ error: active.message }, { status: active.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const role = typeof body.role === "string" ? body.role.trim() : "";

  if (!name || !email) {
    return NextResponse.json({ error: "name dan email wajib diisi." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 422 });
  }

  // Reject an inactive/unknown role before the user is ever created.
  const roleCheck = await validateRoleAssignable(role);
  if (!roleCheck.ok) {
    return NextResponse.json({ error: roleCheck.message }, { status: roleCheck.status });
  }

  try {
    await writeAuditLog({
      category: "system",
      action: "user.create",
      actor: persona.name,
      entityType: "user",
      entityId: email,
      detail: `Tambah user ${name} dengan role ${role}.`,
    });
  } catch {
    // Audit is best-effort when the DB is unavailable; the assignment is still valid.
  }

  return NextResponse.json({ ok: true, user: { name, email, role, status: "invited" } }, { status: 201 });
}
