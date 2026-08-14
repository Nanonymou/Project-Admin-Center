import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/server/require-super-admin";
import { listAppUsers, setAppUserPassword } from "@/lib/server/app-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — set/reset a login account's password (Super Admin only). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Khusus Super Admin." }, { status: 403 });
  const { id } = await params;

  const exists = (await listAppUsers()).some((u) => u.id === id);
  if (!exists) return NextResponse.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  if (password.length < 6) return NextResponse.json({ error: "Kata sandi minimal 6 karakter." }, { status: 400 });

  const ok = await setAppUserPassword(id, password);
  if (!ok) return NextResponse.json({ error: "Gagal mengubah kata sandi." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
