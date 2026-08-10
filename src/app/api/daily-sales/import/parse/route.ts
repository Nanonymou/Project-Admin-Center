import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

const COLUMNS = ["trxDate", "categoryKey", "qty", "price"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ParsedRow = {
  row: number;
  cells: string[];
  valid: boolean;
  duplicate: boolean;
  issues: string[];
};

/**
 * POST /api/daily-sales/import/parse
 * Body: { csv, projectId?, locationId? }
 *
 * Parses an uploaded Excel-as-CSV file and validates it WITHOUT persisting — the
 * dry-run step before /api/daily-sales/import commits the rows. Checks the header
 * columns, validates each row (date format, qty > 0, price >= 0), and flags rows
 * that duplicate a (trxDate, categoryKey) key within the file. Returns a preview
 * plus valid/invalid/duplicate counts so the UI can show a validation summary.
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

  const rows = parseCsv(csv).filter((r) => r.length && r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV kosong atau tanpa baris data." }, { status: 422 });
  }

  const header = rows[0].map((h) => h.trim());
  const headerOk =
    header.length >= COLUMNS.length &&
    COLUMNS.every((c, i) => (header[i] ?? "").toLowerCase() === c.toLowerCase());

  const data = rows.slice(1);
  const seen = new Set<string>();
  const parsed: ParsedRow[] = data.map((cells, i) => {
    const [trxDate, categoryKey, qty, price] = cells;
    const issues: string[] = [];
    if (!DATE_RE.test((trxDate ?? "").trim())) issues.push("Tanggal tidak valid (YYYY-MM-DD).");
    if (!(categoryKey ?? "").trim()) issues.push("categoryKey kosong.");
    if (!(Number(qty) > 0)) issues.push("qty harus > 0.");
    if (price !== undefined && price.trim() !== "" && !(Number(price) >= 0)) {
      issues.push("price tidak valid.");
    }
    const key = `${(trxDate ?? "").trim()}|${(categoryKey ?? "").trim().toLowerCase()}`;
    const duplicate = seen.has(key);
    if (duplicate) issues.push("Baris duplikat (tanggal + kategori sama).");
    else seen.add(key);
    return { row: i + 2, cells, valid: issues.length === 0, duplicate, issues };
  });

  const validCount = parsed.filter((r) => r.valid).length;
  const duplicateCount = parsed.filter((r) => r.duplicate).length;

  return NextResponse.json({
    columns: COLUMNS,
    headerOk,
    total: parsed.length,
    valid: validCount,
    invalid: parsed.length - validCount,
    duplicateCount,
    preview: parsed.slice(0, 50),
  });
}
