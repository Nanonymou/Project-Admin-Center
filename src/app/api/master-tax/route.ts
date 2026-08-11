import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import {
  listMasterTaxes,
  upsertMasterTax,
  setMasterTaxActive,
} from "@/db/repositories/master-tax-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { assertDomainUnlocked, autoVersionDomain } from "@/lib/server/services/master-lock-guard";
import { PROJECT_TAX_CONFIG, DEFAULT_TAX } from "@/lib/mock/tax-config";

export const dynamic = "force-dynamic";

/** Parse a percent-or-fraction rate into a 0..1 fraction. */
function toFraction(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return NaN;
  return n > 1 ? n / 100 : n;
}

/**
 * GET /api/master-tax — the tax profiles (per project + global default). Falls
 * back to the config tax matrix when the DB is unavailable. Any authenticated
 * persona may read.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const rows = await listMasterTaxes(false);
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      taxes: rows.map((r) => ({
        projectCode: r.projectCode,
        code: r.code,
        label: r.label,
        rate: Number(r.rate),
        active: r.active,
      })),
    });
  } catch {
    const taxes = [
      { projectCode: null, code: DEFAULT_TAX.code, label: DEFAULT_TAX.label, rate: DEFAULT_TAX.rate, active: true },
      ...Object.entries(PROJECT_TAX_CONFIG).map(([projectCode, t]) => ({
        projectCode,
        code: t.code,
        label: t.label,
        rate: t.rate,
        active: true,
      })),
    ];
    return NextResponse.json({ source: "config", count: taxes.length, taxes });
  }
}

/**
 * POST /api/master-tax — create/update a tax profile (upsert by project; a null
 * projectCode is the global default). Body: { projectCode?, code, label, rate }.
 * The rate accepts a percent (11) or fraction (0.11). Locking the tax master
 * blocks edits; a successful change bumps the tax domain version. Leader/Super
 * Admin (canConfigure).
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah pajak." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" && body.projectCode ? body.projectCode : null;
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const rate = toFraction(body.rate);

  if (!code || !label) {
    return NextResponse.json({ error: "code dan label wajib diisi." }, { status: 400 });
  }
  if (Number.isNaN(rate) || rate > 1) {
    return NextResponse.json({ error: "rate tidak valid (0..1 atau 0..100%)." }, { status: 422 });
  }
  if (projectCode && !canAccessProject(persona, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectCode}.` }, { status: 403 });
  }

  const taxLock = await assertDomainUnlocked("tax");
  if (!taxLock.ok) return NextResponse.json({ error: taxLock.message }, { status: taxLock.status });

  try {
    await upsertMasterTax({
      projectCode,
      code,
      label,
      rate: rate.toFixed(4),
      active: true,
      createdBy: persona.name,
    });
    await writeAuditLog({
      projectId: projectCode ?? undefined,
      category: "master",
      action: "tax.upsert",
      actor: persona.name,
      entityType: "master_tax",
      entityId: projectCode ?? "global",
      detail: `Simpan pajak ${label} (${(rate * 100).toFixed(1)}%) ${projectCode ?? "global"}.`,
    });
    await autoVersionDomain("tax", `Ubah pajak ${projectCode ?? "global"} → ${label}`, persona.name);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/master-tax — activate/deactivate a tax profile.
 * Body: { projectCode?, active }. Leader/Super Admin.
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

  const projectCode = typeof body.projectCode === "string" && body.projectCode ? body.projectCode : null;
  const active = Boolean(body.active);

  const taxLock = await assertDomainUnlocked("tax");
  if (!taxLock.ok) return NextResponse.json({ error: taxLock.message }, { status: taxLock.status });

  try {
    const ok = await setMasterTaxActive(projectCode, active);
    if (!ok) return NextResponse.json({ error: "Profil pajak tidak ditemukan." }, { status: 404 });
    await writeAuditLog({
      projectId: projectCode ?? undefined,
      category: "master",
      action: active ? "tax.activate" : "tax.deactivate",
      actor: persona.name,
      entityType: "master_tax",
      entityId: projectCode ?? "global",
      detail: active ? "Aktifkan profil pajak." : "Nonaktifkan profil pajak.",
    });
    await autoVersionDomain("tax", `${active ? "Aktifkan" : "Nonaktifkan"} pajak ${projectCode ?? "global"}`, persona.name);
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}
