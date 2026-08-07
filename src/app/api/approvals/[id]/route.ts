import { NextResponse, type NextRequest } from "next/server";
import { getApprovalWithHistory } from "@/db/repositories/approval-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/:id
 * Detail of a single approval with its full activity history (stage transitions,
 * comments, reassignments). Enforces that the persona may access the approval's
 * site.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const result = await getApprovalWithHistory(id);
    if (!result) return NextResponse.json({ error: "Approval tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(auth.persona, result.approval.locationId, result.approval.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke approval ini." }, { status: 403 });
    }
    return NextResponse.json({ source: "db", ...result });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
