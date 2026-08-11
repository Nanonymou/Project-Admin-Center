import { NextResponse, type NextRequest } from "next/server";
import {
  listInvoiceTypes,
  upsertInvoiceType,
  setInvoiceTypeActive,
} from "@/db/repositories/invoice-type-repository";
import { requirePersona } from "@/lib/server/rbac";
import { listInvoiceTypes as listConfigInvoiceTypes } from "@/lib/mock/invoice-type-config";

export const dynamic = "force-dynamic";

/** Parse a percent-or-fraction rate into a 0..1 fraction. */
function toFraction(v: unknown): number {
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return NaN;
  return n > 1 ? n / 100 : n;
}

/**
 * GET /api/jenis-invoice — invoice type profiles. Falls back to the config
 * catalogue when the database is unavailable, so it always responds. Any
 * authenticated persona may read.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const rows = await listInvoiceTypes(false);
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({ source: "db", count: rows.length, types: rows });
  } catch {
    const types = listConfigInvoiceTypes().map((t) => ({
      code: t.key,
      label: t.label,
      deductionRate: t.deductionRate,
      hasBbm: t.hasBbm,
      bbmRate: t.bbmRate,
      active: true,
    }));
    return NextResponse.json({ source: "config", count: types.length, types });
  }
}

/**
 * POST /api/jenis-invoice — create/update an invoice type (upsert by code).
 * Body: { code, label, deductionRate, hasBbm?, bbmRate?, projectCode? }
 * Authorization: Leader/Super Admin.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah jenis invoice." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const hasBbm = Boolean(body.hasBbm);
  const deductionRate = toFraction(body.deductionRate ?? 0);
  const bbmRate = hasBbm ? toFraction(body.bbmRate ?? 0) : 0;
  const projectCode = typeof body.projectCode === "string" ? body.projectCode : null;

  if (!code || !label) {
    return NextResponse.json({ error: "code dan label wajib diisi." }, { status: 400 });
  }
  if (Number.isNaN(deductionRate) || Number.isNaN(bbmRate)) {
    return NextResponse.json({ error: "deductionRate/bbmRate tidak valid." }, { status: 422 });
  }

  try {
    await upsertInvoiceType({
      code,
      label,
      deductionRate: deductionRate.toFixed(4),
      hasBbm,
      bbmRate: bbmRate.toFixed(4),
      projectCode,
      active: true,
      createdBy: persona.name,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/jenis-invoice — activate/deactivate an invoice type.
 * Body: { code, active }. Authorization: Leader/Super Admin.
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
    await setInvoiceTypeActive(code, active);
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}
