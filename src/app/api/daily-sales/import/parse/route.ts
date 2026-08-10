import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import {
  validateImport,
  DAILY_SALES_IMPORT_SPEC,
} from "@/lib/server/services/import-validation-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/daily-sales/import/parse
 * Body: { csv, projectId?, locationId? }
 *
 * Parses an uploaded Excel-as-CSV file and validates it WITHOUT persisting — the
 * dry-run step before /api/daily-sales/import commits the rows. Delegates parsing,
 * per-row validation, and (trxDate, categoryKey) duplicate detection to the shared
 * import-validation service, then returns a preview plus counts.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const csv = typeof body.csv === "string" ? body.csv : "";
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const locationId = typeof body.locationId === "string" ? body.locationId : undefined;
  if (!csv) {
    return NextResponse.json({ error: "csv wajib diisi." }, { status: 400 });
  }
  if (projectId && locationId && !canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  const result = validateImport(csv, DAILY_SALES_IMPORT_SPEC);
  if (!result) {
    return NextResponse.json({ error: "CSV kosong atau tanpa baris data." }, { status: 422 });
  }

  return NextResponse.json({
    columns: DAILY_SALES_IMPORT_SPEC.columns,
    headerOk: result.headerOk,
    total: result.total,
    valid: result.valid,
    invalid: result.invalid,
    duplicateCount: result.duplicateCount,
    preview: result.rows.slice(0, 50),
  });
}
