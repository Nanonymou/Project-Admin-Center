import { NextResponse, type NextRequest } from "next/server";
import { recordImportExportJob } from "@/db/repositories/import-export-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** Unique-key columns per module — used to detect duplicate rows in the file. */
const KEY_COLUMNS: Record<string, string[]> = {
  categories: ["kind", "categorykey"],
  timeframes: ["subjecttype", "stage"],
  areas: ["locationid", "areacode"],
  daily_sales: ["trxdate", "categorykey"],
  daily_cost: ["trxdate", "categorykey"],
};

/**
 * POST /api/import-export/import
 * Body: { module, projectId?, csv }
 *
 * Parses an import CSV and validates it, detecting rows that duplicate a key
 * within the file (the first occurrence is kept, later ones reported). Records an
 * import job in the history. Restricted to configure-capable personas with access
 * to the project. This endpoint validates & reports; module-specific persistence
 * is handled by the module import endpoints.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Tidak memiliki hak impor." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const module = typeof body.module === "string" ? body.module : "";
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const csv = typeof body.csv === "string" ? body.csv : "";
  const keyCols = KEY_COLUMNS[module];
  if (!keyCols || !csv) {
    return NextResponse.json(
      { error: `module (${Object.keys(KEY_COLUMNS).join("|")}) dan csv wajib diisi.` },
      { status: 400 },
    );
  }
  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const rows = parseCsv(csv).filter((r) => r.length && r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV kosong atau tanpa baris data." }, { status: 422 });
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const keyIdx = keyCols.map((c) => header.indexOf(c));
  if (keyIdx.some((i) => i < 0)) {
    return NextResponse.json(
      { error: `Header wajib memuat kolom kunci: ${keyCols.join(", ")}.` },
      { status: 422 },
    );
  }

  const seen = new Set<string>();
  const duplicates: { row: number; key: string }[] = [];
  let unique = 0;
  const data = rows.slice(1);
  data.forEach((r, i) => {
    const key = keyIdx.map((idx) => (r[idx] ?? "").trim()).join("|");
    if (seen.has(key)) {
      duplicates.push({ row: i + 2, key }); // +2 for 1-based + header row
    } else {
      seen.add(key);
      unique += 1;
    }
  });

  const report = { total: data.length, unique, duplicateCount: duplicates.length, duplicates };

  try {
    await recordImportExportJob({
      direction: "import",
      entity: module,
      projectId,
      format: "csv",
      status: duplicates.length > 0 ? "completed" : "completed",
      totalRows: data.length,
      processedRows: unique,
      failedRows: duplicates.length,
      actor: persona.name,
      detail: `Impor ${module}: ${unique} unik, ${duplicates.length} duplikat.`,
      completedAt: new Date(),
    });
    return NextResponse.json({ source: "db", module, ...report });
  } catch {
    return NextResponse.json({ source: "mock", module, ...report });
  }
}
