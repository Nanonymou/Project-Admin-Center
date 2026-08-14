import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/server/require-super-admin";
import { createAppUser, emailExists, listAppUsers } from "@/lib/server/app-users";
import { PERSONAS } from "@/lib/personas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PERSONA_IDS = new Set(PERSONAS.map((p) => p.id));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET — list all login accounts (Super Admin only). */
export async function GET() {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Khusus Super Admin." }, { status: 403 });
  const users = await listAppUsers();
  return NextResponse.json({ users });
}

/** POST — create a login account (Super Admin only). */
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Khusus Super Admin." }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    personaId?: string;
    password?: string;
    isActive?: boolean;
  } | null;
  if (!body) return NextResponse.json({ error: "Body tidak valid." }, { status: 400 });

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const personaId = body.personaId ?? "";
  const password = body.password ?? "";

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Nama minimal 2 karakter." }, { status: 400 });
  if (!VALID_PERSONA_IDS.has(personaId)) return NextResponse.json({ error: "Peran (persona) tidak valid." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });
  if (await emailExists(email)) return NextResponse.json({ error: "Email sudah dipakai." }, { status: 409 });

  const user = await createAppUser({ email, name, personaId, password, isActive: body.isActive ?? true });
  return NextResponse.json({ user }, { status: 201 });
}
