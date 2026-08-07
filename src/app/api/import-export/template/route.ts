import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * CSV import templates per module — a header row plus one example row so users
 * know the expected columns. Kept in sync with the import endpoints' parsers.
 */
const TEMPLATES: Record<string, { header: string[]; example: (string | number)[] }> = {
  categories: {
    header: ["kind", "categoryKey", "label", "subCategory", "unit", "defaultPrice", "isDeduction"],
    example: ["sales", "meals_buffet", "Meals Buffet", "F&B", "porsi", 45000, "0"],
  },
  timeframes: {
    header: ["subjectType", "stage", "slaDays", "orderIndex"],
    example: ["invoice", "Verifikasi Site", 2, 0],
  },
  areas: {
    header: ["locationId", "locationName", "areaCode", "areaName"],
    example: ["km22", "KM22", "km22-area-0", "KM22 — Mess Hall A"],
  },
  daily_sales: {
    header: ["trxDate", "categoryKey", "qty", "price"],
    example: ["2026-01-15", "meals_buffet", 120, 45000],
  },
  daily_cost: {
    header: ["trxDate", "categoryKey", "amount"],
    example: ["2026-01-15", "food_meals", 3500000],
  },
};

/**
 * GET /api/import-export/template?module=categories|timeframes|areas|daily_sales|daily_cost
 * Returns the CSV import template (header + example row) for a module. Requires
 * an authenticated persona with configure or export rights.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure && !persona.capabilities.canExport) {
    return NextResponse.json({ error: "Tidak memiliki hak akses template." }, { status: 403 });
  }

  const module = req.nextUrl.searchParams.get("module") ?? "";
  const tpl = TEMPLATES[module];
  if (!tpl) {
    return NextResponse.json(
      { error: `module tidak dikenal. Pilihan: ${Object.keys(TEMPLATES).join(", ")}.` },
      { status: 400 },
    );
  }

  const csv = toCsv([tpl.header, tpl.example]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="template-${module}.csv"`,
    },
  });
}
