import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { runNotificationGenerator } from "@/lib/server/services/notification-generator-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/pusat-notifikasi/generate — run the notification generator: create
 * deadline + overdue-invoice notifications for every persona (scoped to their
 * sites) and persist them to the notifications table. This is the entry point a
 * scheduled job calls, so it is restricted to Super Admin.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin yang dapat menjalankan generator." }, { status: 403 });
  }

  const result = await runNotificationGenerator();
  return NextResponse.json({ ok: true, ...result });
}
