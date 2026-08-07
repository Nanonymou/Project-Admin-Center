import { NextResponse, type NextRequest } from "next/server";
import { upsertMasterCategory } from "@/db/repositories/master-category-repository";
import { upsertMasterTimeframe } from "@/db/repositories/master-timeframe-repository";
import { upsertMasterArea } from "@/db/repositories/master-area-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { parseCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

function headerIndex(header: string[]) {
  const map: Record<string, number> = {};
  header.forEach((h, i) => (map[h.trim().toLowerCase()] = i));
  return map;
}

/**
 * POST /api/master/import
 * Body: { type: categories|timeframes|areas, projectId, csv }
 *
 * Imports master data from Excel-compatible CSV, upserting each row. The header
 * row names the columns (matching the export format). Restricted to
 * configure-capable personas with access to the project.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Persona ini tidak berhak mengimpor master data." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type : "";
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const csv = typeof body.csv === "string" ? body.csv : "";
  if (!projectId || !csv || !["categories", "timeframes", "areas"].includes(type)) {
    return NextResponse.json(
      { error: "type (categories|timeframes|areas), projectId, dan csv wajib diisi." },
      { status: 400 },
    );
  }
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const rows = parseCsv(csv).filter((r) => r.length && r.some((c) => c.trim() !== ""));
  if (rows.length < 2) {
    return NextResponse.json({ error: "CSV kosong atau tanpa baris data." }, { status: 422 });
  }
  const idx = headerIndex(rows[0]);
  const data = rows.slice(1);
  let imported = 0;
  const errors: string[] = [];

  try {
    for (const r of data) {
      try {
        if (type === "categories") {
          const kind = (r[idx.kind] ?? "").trim();
          const categoryKey = (r[idx.categorykey] ?? "").trim();
          if ((kind !== "sales" && kind !== "cost") || !categoryKey) throw new Error("baris tidak valid");
          await upsertMasterCategory({
            projectCode: projectId,
            kind,
            categoryKey,
            label: (r[idx.label] ?? categoryKey).trim(),
            subCategory: (r[idx.subcategory] ?? "").trim() || undefined,
            unit: (r[idx.unit] ?? "").trim() || undefined,
            defaultPrice: (Number(r[idx.defaultprice]) || 0).toFixed(2),
            isDeduction: (r[idx.isdeduction] ?? "0").trim() === "1",
          });
        } else if (type === "timeframes") {
          const subjectType = (r[idx.subjecttype] ?? "").trim();
          const stage = (r[idx.stage] ?? "").trim();
          if (!subjectType || !stage) throw new Error("baris tidak valid");
          await upsertMasterTimeframe({
            projectCode: projectId,
            subjectType,
            stage,
            slaDays: Number(r[idx.sladays]) || 0,
            orderIndex: Number(r[idx.orderindex]) || 0,
          });
        } else {
          const locationId = (r[idx.locationid] ?? "").trim();
          const areaCode = (r[idx.areacode] ?? "").trim();
          if (!locationId || !areaCode) throw new Error("baris tidak valid");
          await upsertMasterArea({
            projectId,
            locationId,
            areaCode,
            name: (r[idx.areaname] ?? areaCode).trim(),
          });
        }
        imported += 1;
      } catch (rowErr) {
        errors.push(rowErr instanceof Error ? rowErr.message : String(rowErr));
      }
    }
    return NextResponse.json({ source: "db", type, imported, total: data.length, errors });
  } catch (err) {
    return NextResponse.json(
      {
        source: "mock",
        simulated: true,
        message: "Impor tidak tersedia tanpa database.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
