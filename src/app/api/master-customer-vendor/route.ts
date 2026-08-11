import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  listCustomerVendors,
  upsertCustomerVendor,
  setCustomerVendorActive,
} from "@/db/repositories/customer-vendor-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { validatePartyInput } from "@/lib/server/services/customer-vendor-validation-service";
import { listCustomerVendors as listConfigParties } from "@/lib/mock/customer-vendor";

export const dynamic = "force-dynamic";

/**
 * GET /api/master-customer-vendor?type=customer|vendor&activeOnly=1&q=&category=&city=
 * Org-level customer/vendor master with query filters: free-text search (`q`
 * over code/name/contact/email), `category`, and `city`. Falls back to the config
 * catalogue when the DB is unavailable. Any authenticated persona may read.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const sp = req.nextUrl.searchParams;
  const typeRaw = sp.get("type");
  const type = typeRaw === "customer" || typeRaw === "vendor" ? typeRaw : undefined;
  const activeOnly = sp.get("activeOnly") === "1" || sp.get("activeOnly") === "true";
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const category = (sp.get("category") ?? "").trim().toLowerCase();
  const city = (sp.get("city") ?? "").trim().toLowerCase();

  type Party = {
    code: string;
    name: string;
    type: string;
    category: string;
    contactPerson: string;
    phone: string;
    email: string;
    city: string;
    npwp: string;
    address: string;
    active: boolean;
  };

  // Apply the free-text / category / city filters uniformly to either source.
  const applyFilters = (parties: Party[]): Party[] =>
    parties.filter((p) => {
      if (category && !p.category.toLowerCase().includes(category)) return false;
      if (city && !p.city.toLowerCase().includes(city)) return false;
      if (q && !`${p.code} ${p.name} ${p.contactPerson} ${p.email}`.toLowerCase().includes(q)) return false;
      return true;
    });

  try {
    const rows = await listCustomerVendors({ type, activeOnly });
    if (rows.length === 0) throw new Error("empty");
    const parties = applyFilters(
      rows.map((r) => ({
        code: r.code,
        name: r.name,
        type: r.type,
        category: r.category,
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        city: r.city,
        npwp: r.npwp,
        address: r.address,
        active: r.active,
      })),
    );
    return NextResponse.json({ source: "db", count: parties.length, parties });
  } catch {
    let configParties = listConfigParties();
    if (type) configParties = configParties.filter((p) => p.type === type);
    if (activeOnly) configParties = configParties.filter((p) => p.status === "active");
    const parties = applyFilters(
      configParties.map((p) => ({
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
      })),
    );
    return NextResponse.json({ source: "config", count: parties.length, parties });
  }
}

/**
 * POST /api/master-customer-vendor — create/update a party (upsert by code).
 * Body: { code, name, type, category?, contactPerson?, phone?, email?, city?, npwp?, address? }
 * Leader/Super Admin (canConfigure).
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah data ini." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const code = str(body.code);
  const name = str(body.name);
  const type = str(body.type);
  const email = str(body.email);
  const phone = str(body.phone);
  const npwp = str(body.npwp);

  const errors = validatePartyInput({ code, name, type, email, phone, npwp });
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0].message, errors }, { status: 422 });
  }

  try {
    await upsertCustomerVendor({
      code,
      name,
      type,
      category: str(body.category),
      contactPerson: str(body.contactPerson),
      phone,
      email,
      city: str(body.city),
      npwp,
      address: str(body.address),
      active: true,
      createdBy: persona.name,
    });
    await writeAuditLog({
      category: "master",
      action: "customer_vendor.upsert",
      actor: persona.name,
      entityType: "customer_vendor",
      entityId: code,
      detail: `Simpan ${type} ${name}.`,
    });
    return NextResponse.json({ ok: true, code }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/master-customer-vendor — activate/deactivate a party.
 * Body: { code, active }. Leader/Super Admin.
 */
export async function PATCH(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah status." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const active = Boolean(body.active);
  if (!code) return NextResponse.json({ error: "code wajib diisi." }, { status: 400 });

  try {
    const ok = await setCustomerVendorActive(code, active);
    if (!ok) return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
    await writeAuditLog({
      category: "master",
      action: active ? "customer_vendor.activate" : "customer_vendor.deactivate",
      actor: persona.name,
      entityType: "customer_vendor",
      entityId: code,
      detail: active ? "Aktifkan customer/vendor." : "Nonaktifkan customer/vendor.",
    });
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * DELETE /api/master-customer-vendor?code= — soft-deactivate a party (permanent
 * deletion is not allowed: a party may be referenced by historical invoices).
 * Leader/Super Admin.
 */
export async function DELETE(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat menghapus." }, { status: 403 });
  }

  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) return NextResponse.json({ error: "code wajib diisi." }, { status: 400 });

  try {
    const ok = await setCustomerVendorActive(code, false);
    if (!ok) return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 404 });
    await writeAuditLog({
      category: "master",
      action: "customer_vendor.soft_delete",
      actor: persona.name,
      entityType: "customer_vendor",
      entityId: code,
      detail: "Permintaan hapus → dinonaktifkan (hapus permanen dilarang).",
    });
    return NextResponse.json({
      ok: true,
      softDeleted: true,
      message: "Hapus permanen tidak diizinkan; data dinonaktifkan.",
    });
  } catch {
    return NextResponse.json({ error: "Gagal memproses (database tidak tersedia)." }, { status: 503 });
  }
}
