import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  listRoles as listDbRoles,
  getRole,
  upsertRole,
  setRoleActive,
  deleteCustomRole,
} from "@/db/repositories/role-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import {
  listRoles as listConfigRoles,
  rbacModules,
  type RbacModule,
  type RbacAction,
} from "@/lib/mock/rbac";

export const dynamic = "force-dynamic";

const VALID_ACTIONS: RbacAction[] = ["view", "create", "edit", "approve", "configure", "export"];

/** Coerce an arbitrary permissions payload into a clean module→actions matrix. */
function sanitizePermissions(raw: unknown): Record<RbacModule, RbacAction[]> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const src = raw as Record<string, unknown>;
  const out = {} as Record<RbacModule, RbacAction[]>;
  for (const mod of rbacModules()) {
    const list = Array.isArray(src[mod]) ? (src[mod] as unknown[]) : [];
    out[mod] = list.filter((a): a is RbacAction => VALID_ACTIONS.includes(a as RbacAction));
  }
  return out;
}

/**
 * GET /api/role — the role catalogue with each role's permission matrix. Falls
 * back to the config-defined roles when the database is unavailable. Any
 * authenticated persona may read.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const rows = await listDbRoles(false);
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({ source: "db", count: rows.length, roles: rows });
  } catch {
    const roles = listConfigRoles().map((r) => ({
      role: r.role,
      label: r.label,
      description: r.description,
      permissions: r.permissions,
      isSystem: true,
      active: true,
    }));
    return NextResponse.json({ source: "config", count: roles.length, roles });
  }
}

/**
 * POST /api/role — create/update a custom role (upsert by key).
 * Body: { role, label, description?, permissions }. System roles' permissions may
 * also be edited here, but the key must already exist. Leader/Super Admin.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah role." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const permissions = sanitizePermissions(body.permissions);

  if (!/^[a-z][a-z0-9_]*$/.test(role)) {
    return NextResponse.json({ error: "Kode role harus huruf kecil/underscore (mis. site_admin)." }, { status: 422 });
  }
  if (!label) {
    return NextResponse.json({ error: "Label role wajib diisi." }, { status: 422 });
  }
  if (!permissions) {
    return NextResponse.json({ error: "Matriks permissions tidak valid." }, { status: 422 });
  }

  try {
    // Upsert by the unique key: an existing key (system or custom) has its
    // label/description/permissions refreshed; a new key creates a custom role.
    // isSystem is never toggled here, so a seeded system role stays a system role.
    const existing = await getRole(role);
    await upsertRole({ role, label, description, permissions, createdBy: persona.name });
    await writeAuditLog({
      category: "system",
      action: existing ? "role.update" : "role.create",
      actor: persona.name,
      entityType: "role",
      entityId: role,
      detail: `${existing ? "Ubah" : "Buat"} role ${label}.`,
    });
    return NextResponse.json({ ok: true, role }, { status: existing ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan role (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/role — activate/deactivate a role (soft; the row is retained so
 * historical assignments stay resolvable). Body: { role, active }. Leader/Super Admin.
 */
export async function PATCH(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah status." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role.trim() : "";
  const active = Boolean(body.active);
  if (!role) return NextResponse.json({ error: "role wajib diisi." }, { status: 400 });

  try {
    await setRoleActive(role, active);
    await writeAuditLog({
      category: "system",
      action: active ? "role.activate" : "role.deactivate",
      actor: persona.name,
      entityType: "role",
      entityId: role,
      detail: active ? "Aktifkan role." : "Nonaktifkan role.",
    });
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * DELETE /api/role?role= — permanently delete a CUSTOM role. System roles cannot
 * be deleted (409) — deactivate them via PATCH instead. Leader/Super Admin.
 */
export async function DELETE(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat menghapus role." }, { status: 403 });
  }

  const role = req.nextUrl.searchParams.get("role")?.trim() ?? "";
  if (!role) return NextResponse.json({ error: "role wajib diisi." }, { status: 400 });

  try {
    const deleted = await deleteCustomRole(role);
    if (!deleted) {
      return NextResponse.json(
        { error: "Role sistem tidak dapat dihapus — nonaktifkan saja." },
        { status: 409 },
      );
    }
    await writeAuditLog({
      category: "system",
      action: "role.delete",
      actor: persona.name,
      entityType: "role",
      entityId: role,
      detail: "Hapus role custom.",
    });
    return NextResponse.json({ ok: true, deleted: true });
  } catch {
    return NextResponse.json({ error: "Gagal menghapus role (database tidak tersedia)." }, { status: 503 });
  }
}
