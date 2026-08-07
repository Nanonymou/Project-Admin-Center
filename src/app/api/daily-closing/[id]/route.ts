import { NextResponse, type NextRequest } from "next/server";
import { getDailyClosingWithHistory } from "@/db/repositories/daily-closing-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/daily-closing/:id
 * A single daily-closing status with its full history. Enforces that the persona
 * may access the closing's site.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const result = await getDailyClosingWithHistory(id);
    if (!result) return NextResponse.json({ error: "Closing tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(auth.persona, result.closing.locationId, result.closing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke closing ini." }, { status: 403 });
    }
    return NextResponse.json({ source: "db", ...result });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
