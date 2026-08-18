import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/server/require-super-admin";
import {
  countActiveSuperAdmins,
  deleteAppUser,
  emailExists,
  listAppUsers,
  updateAppUser,
} from "@/lib/server/app-users";
import { PERSONAS } from "@/lib/personas";
import { sanitizeLocationIds } from "@/lib/site-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PERSONA_IDS = new Set(PERSONAS.map((p) => p.id));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findById(id: string) {
  return (await listAppUsers()).find((u) => u.id === id);
}

/** PATCH — edit a login account: email, name, persona/role, active (Super Admin only). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Khusus Super Admin." }, { status: 403 });
  const { id } = await params;

  const target = await findById(id);
  if (!target) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    personaId?: string;
    locations?: string[];
    isActive?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const patch: { email?: string; name?: string; personaId?: string; locations?: string[]; isActive?: boolean } = {};

  if (body.locations !== undefined) {
    patch.locations = sanitizeLocationIds(Array.isArray(body.locations) ? body.locations : []);
  }

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
    if (await emailExists(email, id)) return NextResponse.json({ error: "Email sudah dipakai." }, { status: 409 });
    patch.email = email;
  }
  if (body.name !== undefined) {
    if (body.name.trim().length < 2) return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
    patch.name = body.name.trim();
  }
  if (body.personaId !== undefined) {
    if (!VALID_PERSONA_IDS.has(body.personaId)) return NextResponse.json({ error: "Peran tidak valid." }, { status: 400 });
    patch.personaId = body.personaId;
  }
  if (body.isActive !== undefined) patch.isActive = body.isActive;

  // Guard: don't let the last active Super Admin lose the role or be deactivated.
  const losingSuper =
    target.personaId === "persona-super" &&
    ((patch.personaId !== undefined && patch.personaId !== "persona-super") || patch.isActive === false);
  if (losingSuper && (await countActiveSuperAdmins(id)) === 0) {
    return NextResponse.json({ error: "Harus ada minimal satu Super Admin aktif." }, { status: 409 });
  }

  const user = await updateAppUser(id, patch);
  return NextResponse.json({ user });
}

/** DELETE — remove a login account (Super Admin only). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Khusus Super Admin." }, { status: 403 });
  const { id } = await params;

  const target = await findById(id);
  if (!target) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  if (target.email === admin.email) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun Anda sendiri." }, { status: 409 });
  }
  if (target.personaId === "persona-super" && (await countActiveSuperAdmins(id)) === 0) {
    return NextResponse.json({ error: "Harus ada minimal satu Super Admin aktif." }, { status: 409 });
  }

  await deleteAppUser(id);
  return NextResponse.json({ ok: true });
}
