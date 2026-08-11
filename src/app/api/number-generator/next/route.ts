import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { generateNextNumber, previewNextNumber } from "@/lib/server/services/number-generator-service";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/number-generator/next?docType= — PREVIEW the next number for a doc
 * type without claiming it (the counter is not advanced). Any authenticated
 * persona may preview.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const docType = req.nextUrl.searchParams.get("docType")?.trim() ?? "";
  if (!docType) return NextResponse.json({ error: "docType wajib diisi." }, { status: 400 });

  const result = await previewNextNumber(docType);
  if (!result) return NextResponse.json({ error: `Format untuk "${docType}" tidak ditemukan.` }, { status: 404 });
  return NextResponse.json({ preview: true, ...result });
}

/**
 * POST /api/number-generator/next — CLAIM the next number for a doc type,
 * atomically advancing its sequence counter. Body: { docType }. Used when a
 * document is actually created. Viewer cannot claim numbers.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menerbitkan nomor dokumen." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const docType = typeof body.docType === "string" ? body.docType.trim() : "";
  if (!docType) return NextResponse.json({ error: "docType wajib diisi." }, { status: 400 });

  const result = await generateNextNumber(docType);
  if (!result) return NextResponse.json({ error: `Format untuk "${docType}" tidak ditemukan.` }, { status: 404 });

  // Record the issuance only when it was actually persisted.
  if (result.source === "db") {
    try {
      await writeAuditLog({
        category: "master",
        action: "number.issue",
        actor: persona.name,
        entityType: "document_number",
        entityId: result.number,
        detail: `Terbitkan nomor ${result.number} (${docType}, seq ${result.seq}).`,
      });
    } catch {
      // audit best-effort
    }
  }

  return NextResponse.json({ claimed: true, ...result }, { status: 201 });
}
