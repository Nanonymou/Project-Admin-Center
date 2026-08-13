import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { getCustomerVendorByCode } from "@/db/repositories/customer-vendor-repository";
import { listCustomerVendors as listConfigParties } from "@/lib/mock/customer-vendor";

export const dynamic = "force-dynamic";

/**
 * GET /api/master-customer-vendor/[code]
 *
 * Single party detail, used to auto-fill forms (e.g. selecting a customer on an
 * invoice populates its contact, NPWP, and address). Falls back to the config
 * catalogue when the DB is unavailable so the auto-fill still works. Any
 * authenticated persona may read.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { code: rawCode } = await ctx.params;
  const code = decodeURIComponent(rawCode ?? "").trim();
  if (!code) return NextResponse.json({ error: "code wajib diisi." }, { status: 400 });

  try {
    const row = await getCustomerVendorByCode(code);
    if (!row) throw new Error("not-found-db");
    return NextResponse.json({
      source: "db",
      party: {
        code: row.code,
        name: row.name,
        type: row.type,
        category: row.category,
        contactPerson: row.contactPerson,
        phone: row.phone,
        email: row.email,
        city: row.city,
        npwp: row.npwp,
        address: row.address,
        active: row.active,
      },
    });
  } catch {
    const p = listConfigParties().find((x) => x.code === code);
    if (!p) return NextResponse.json({ error: `Customer/vendor "${code}" tidak ditemukan.` }, { status: 404 });
    return NextResponse.json({
      source: "config",
      party: {
        code: p.code,
        name: p.name,
        type: p.type,
        category: p.category,
        contactPerson: p.contactPerson,
        phone: p.phone,
        email: p.email,
        city: p.city,
        npwp: p.npwp,
        address: p.address,
        active: p.status === "active",
      },
    });
  }
}
