import { NextResponse, type NextRequest } from "next/server";
import { seedDatabase } from "@/db/seed";
import { seedMasterCategories } from "@/db/seed-master";
import { requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/dev/seed?days=60
 * Development-only helper to populate sample daily transactions for chart
 * testing. Disabled in production and restricted to Super Admin. Revalidates the
 * KPI cache after seeding so dashboards pick up the new data.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Seeder dinonaktifkan di production." }, { status: 403 });
  }

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  if (auth.persona.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin yang dapat menjalankan seeder." }, { status: 403 });
  }

  const daysRaw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 180) : undefined;

  try {
    const master = await seedMasterCategories();
    const result = await seedDatabase({ days });
    revalidateKpi();
    return NextResponse.json({ ok: true, master, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
