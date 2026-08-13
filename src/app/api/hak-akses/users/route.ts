import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  listUsers,
  createUser,
  updateUser,
  setUserStatus,
  type SiteGrantInput,
} from "@/db/repositories/user-repository";
import { validateRoleAssignable } from "@/lib/server/services/role-assignment-validation-service";
import { enforceActiveRole } from "@/lib/server/services/effective-access-service";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { listManagedUsers } from "@/lib/mock/rbac";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["active", "invited", "suspended"]);
const KNOWN_PROJECTS = new Set(MOCK_WORKSPACES.map((w) => w.projectCode));
const KNOWN_LOCATIONS = new Map(MOCK_WORKSPACES.map((w) => [w.locationId, w.projectCode]));

/**
 * Parse + validate a raw site-access payload into normalized grants. Each grant
 * must name a known project; a location, when given, must belong to that project.
 * Returns the grants or an error message.
 */
function parseSiteAccess(raw: unknown): { grants: SiteGrantInput[] } | { error: string } {
  if (!Array.isArray(raw)) return { grants: [] };
  const grants: SiteGrantInput[] = [];
  for (const item of raw) {
    const g = item as Record<string, unknown>;
    const projectCode = typeof g?.projectCode === "string" ? g.projectCode : "";
    const locationId = typeof g?.locationId === "string" && g.locationId ? g.locationId : null;
    if (!KNOWN_PROJECTS.has(projectCode)) return { error: `Project "${projectCode}" tidak dikenal.` };
    if (locationId && KNOWN_LOCATIONS.get(locationId) !== projectCode) {
      return { error: `Lokasi "${locationId}" bukan bagian project ${projectCode}.` };
    }
    grants.push({ projectCode, locationId });
  }
  return { grants };
}

/**
 * GET /api/hak-akses/users — managed users with their site-access grants. Falls
 * back to the config directory (MANAGED_USERS) when the DB is unavailable.
 * Leader/Super Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Manajemen user hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  try {
    const rows = await listUsers();
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      users: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        siteAccess: u.siteAccess.map((g) => ({ projectCode: g.projectCode, locationId: g.locationId })),
      })),
    });
  } catch {
    const users = listManagedUsers().map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      siteAccess: u.siteAccess.flatMap((g): { projectCode: string; locationId: string | null }[] =>
        g.locations.length === 0
          ? [{ projectCode: g.projectCode, locationId: null }]
          : g.locations.map((locationId) => ({ projectCode: g.projectCode, locationId })),
      ),
    }));
    return NextResponse.json({ source: "config", count: users.length, users });
  }
}

/**
 * POST /api/hak-akses/users — create a managed user with role + site grants.
 * Body: { name, email, role, status?, siteAccess: [{ projectCode, locationId? }] }.
 * The role must be active/known; site grants must reference valid project/location.
 * Leader/Super Admin only.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat menambah user." }, { status: 403 });
  }
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
  const status = typeof body.status === "string" && VALID_STATUS.has(body.status) ? body.status : "invited";

  if (!name || !email) {
    return NextResponse.json({ error: "name dan email wajib diisi." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid." }, { status: 422 });
  }
  const roleCheck = await validateRoleAssignable(role);
  if (!roleCheck.ok) return NextResponse.json({ error: roleCheck.message }, { status: roleCheck.status });

  const parsed = parseSiteAccess(body.siteAccess);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 422 });

  try {
    const id = await createUser({ name, email, role, status, siteAccess: parsed.grants, createdBy: persona.name });
    await writeAuditLog({
      category: "system",
      action: "user.create",
      actor: persona.name,
      entityType: "user",
      entityId: id,
      detail: `Tambah user ${name} (${role}) dengan ${parsed.grants.length} akses site.`,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan user (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/hak-akses/users — update a user's name/role/status and/or replace
 * its site grants. Body: { id, name?, role?, status?, siteAccess? }.
 * Leader/Super Admin only.
 */
export async function PATCH(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah user." }, { status: 403 });
  }
  const active = await enforceActiveRole(persona);
  if (!active.ok) return NextResponse.json({ error: active.message }, { status: active.status });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const status =
    typeof body.status === "string" && VALID_STATUS.has(body.status) ? body.status : undefined;

  let role: string | undefined;
  if (typeof body.role === "string" && body.role.trim()) {
    role = body.role.trim();
    const roleCheck = await validateRoleAssignable(role);
    if (!roleCheck.ok) return NextResponse.json({ error: roleCheck.message }, { status: roleCheck.status });
  }

  let siteAccess: SiteGrantInput[] | undefined;
  if (body.siteAccess !== undefined) {
    const parsed = parseSiteAccess(body.siteAccess);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 422 });
    siteAccess = parsed.grants;
  }

  try {
    const ok = await updateUser({ id, name, role, status, siteAccess, updatedBy: persona.name });
    if (!ok) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    await writeAuditLog({
      category: "system",
      action: "user.update",
      actor: persona.name,
      entityType: "user",
      entityId: id,
      detail: "Ubah data / akses site user.",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan perubahan (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * DELETE /api/hak-akses/users?id= — suspend a user (soft; the account and its
 * grants are retained so audit history stays intact). Leader/Super Admin only.
 */
export async function DELETE(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat menonaktifkan user." }, { status: 403 });
  }
  const active = await enforceActiveRole(persona);
  if (!active.ok) return NextResponse.json({ error: active.message }, { status: active.status });

  const id = req.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  try {
    const ok = await setUserStatus(id, "suspended");
    if (!ok) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });
    await writeAuditLog({
      category: "system",
      action: "user.suspend",
      actor: persona.name,
      entityType: "user",
      entityId: id,
      detail: "Nonaktifkan (suspend) user — hapus permanen dilarang.",
    });
    return NextResponse.json({ ok: true, suspended: true });
  } catch {
    return NextResponse.json({ error: "Gagal memproses (database tidak tersedia)." }, { status: 503 });
  }
}
