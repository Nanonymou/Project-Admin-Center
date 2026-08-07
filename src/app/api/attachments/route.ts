import { NextResponse, type NextRequest } from "next/server";
import { listAllAttachments, type AttachmentCenterFilter } from "@/db/repositories/attachment-center-repository";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/attachments?projectId=&locationId=&source=&category=&limit=&scope=
 * Unified Attachment Center feed — invoice and daily-transaction attachments in
 * one list, newest first, scoped to the persona. Cross-site (executive) access
 * is restricted to Leader/Super Admin. Returns an empty list when the database
 * is unavailable (attachments have no mock source).
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const source = sp.get("source") ?? undefined;
  const category = sp.get("category") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  const filter: AttachmentCenterFilter = { projectId, locationId, source, category, limit, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, { projectId, locationId, scope });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listAllAttachments(filter)).filter(
      (r) => !r.projectId || canAccessLocation(persona, r.locationId ?? "", r.projectId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, attachments: rows });
  } catch {
    return NextResponse.json({ source: "mock", filter, count: 0, attachments: [] });
  }
}
