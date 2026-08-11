import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  getRole,
  setRolePermissions,
  listRolePermissions,
} from "@/db/repositories/role-repository";
import { enforceActiveRole } from "@/lib/server/services/effective-access-service";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import {
  getRoleDefinition,
  rbacModules,
  type PersonaRole,
  type RbacModule,
  type RbacAction,
} from "@/lib/mock/rbac";

export const dynamic = "force-dynamic";

const VALID_ACTIONS: RbacAction[] = ["view", "create", "edit", "approve", "configure", "export"];
const ROLE_KEYS: PersonaRole[] = ["super_admin", "leader_admin", "site_admin", "viewer"];

/** Coerce a permissions payload into a clean module→actions matrix. */
function sanitizePermissions(raw: unknown): Record<RbacModule, RbacAction[]> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const out = {} as Record<RbacModule, RbacAction[]>;
  for (const mod of rbacModules()) {
    const list = Array.isArray(src[mod]) ? (src[mod] as unknown[]) : [];
    // De-dupe while filtering to valid actions.
    out[mod] = VALID_ACTIONS.filter((a) => list.includes(a));
  }
  return out;
}

/**
 * GET /api/hak-akses/permissions?role= — a role's current permission matrix
 * (flattened grants when persisted, config default otherwise). Leader/Super Admin.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Kelola izin hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  const role = req.nextUrl.searchParams.get("role")?.trim() ?? "";
  if (!(ROLE_KEYS as string[]).includes(role)) {
    return NextResponse.json({ error: "Role tidak dikenal." }, { status: 404 });
  }

  try {
    const grants = await listRolePermissions(role);
    if (grants.length === 0) throw new Error("empty");
    const permissions = {} as Record<string, string[]>;
    for (const m of rbacModules()) permissions[m] = [];
    for (const g of grants) (permissions[g.module] ??= []).push(g.action);
    return NextResponse.json({ source: "db", role, permissions });
  } catch {
    return NextResponse.json({
      source: "config",
      role,
      permissions: getRoleDefinition(role as PersonaRole).permissions,
    });
  }
}

/**
 * PUT /api/hak-akses/permissions — replace a role's permission matrix with
 * immediate effect. Body: { role, permissions }. Updates the jsonb matrix and
 * the normalized grants atomically so the change applies at once to every user
 * of that role. Leader/Super Admin, active-role enforced.
 */
export async function PUT(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah izin." }, { status: 403 });
  }
  const active = await enforceActiveRole(persona);
  if (!active.ok) return NextResponse.json({ error: active.message }, { status: active.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role.trim() : "";
  const permissions = sanitizePermissions(body.permissions);
  if (!role) return NextResponse.json({ error: "role wajib diisi." }, { status: 400 });
  if (!permissions) return NextResponse.json({ error: "Matriks permissions tidak valid." }, { status: 422 });

  // Guard: a Super Admin must never be stripped of user-management access, or the
  // system could be locked out of its own access control.
  if (role === "super_admin" && !permissions.user_management.includes("configure")) {
    return NextResponse.json(
      { error: "Super Admin tidak boleh kehilangan izin konfigurasi Kelola Pengguna." },
      { status: 422 },
    );
  }

  try {
    const existing = await getRole(role);
    if (!existing) return NextResponse.json({ error: "Role tidak ditemukan." }, { status: 404 });
    await setRolePermissions(role, permissions, persona.name);
    await writeAuditLog({
      category: "system",
      action: "role.permissions.update",
      actor: persona.name,
      entityType: "role",
      entityId: role,
      detail: `Perbarui matriks izin role ${existing.label} (efek langsung).`,
    });
    return NextResponse.json({ ok: true, role, permissions });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan izin (database tidak tersedia)." }, { status: 503 });
  }
}
