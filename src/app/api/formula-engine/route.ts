import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import {
  listFormulaParameters,
  getFormulaParameter,
  upsertFormulaParameter,
  setFormulaParameterActive,
  recordFormulaParameterChange,
} from "@/db/repositories/formula-parameter-repository";
import { getBuiltinFormulaParams, getBuiltinFormulaParam } from "@/lib/mock/formula-config";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set(["percent", "days", "flag", "flat"]);

/**
 * GET /api/formula-engine?projectId=
 *
 * The effective formula parameters for a project: the config-derived built-ins
 * merged with DB overrides/custom parameters (override wins by key). Falls back
 * to built-ins only when the DB is unavailable. Requires access to the project.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const projectId = req.nextUrl.searchParams.get("projectId") ?? "";
  if (!projectId) return NextResponse.json({ error: "projectId wajib diisi." }, { status: 400 });
  if (!canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  const builtins = getBuiltinFormulaParams(projectId);

  try {
    const overrides = await listFormulaParameters(projectId);
    const byKey = new Map(overrides.map((o) => [o.key, o]));
    // Start from built-ins (applying any override values), then append custom params.
    const merged = builtins.map((b) => {
      const o = byKey.get(b.key);
      return o
        ? { ...b, value: Number(o.value), active: o.active, overridden: true }
        : { ...b, active: true, overridden: false };
    });
    const builtinKeys = new Set(builtins.map((b) => b.key));
    for (const o of overrides) {
      if (builtinKeys.has(o.key)) continue;
      merged.push({
        key: o.key,
        label: o.label,
        group: o.group,
        type: o.type as "percent" | "days" | "flag" | "flat",
        value: Number(o.value),
        builtin: false,
        active: o.active,
        overridden: true,
      });
    }
    return NextResponse.json({ source: "db", projectId, count: merged.length, parameters: merged });
  } catch {
    const parameters = builtins.map((b) => ({ ...b, active: true, overridden: false }));
    return NextResponse.json({ source: "config", projectId, count: parameters.length, parameters });
  }
}

/**
 * POST /api/formula-engine — create/update a calculation parameter for a project.
 * Body: { projectCode, key, label, group?, type, value }
 * Upserts the parameter and appends a create/update history entry. Overriding a
 * built-in is allowed (its key is reused). Leader/Super Admin (canConfigure).
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah parameter." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const group = typeof body.group === "string" ? body.group.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  const value = Number(body.value);

  if (!projectCode || !key || !label) {
    return NextResponse.json({ error: "projectCode, key, dan label wajib diisi." }, { status: 400 });
  }
  if (!VALID_TYPES.has(type)) {
    return NextResponse.json({ error: "type harus percent, days, flag, atau flat." }, { status: 422 });
  }
  if (Number.isNaN(value)) {
    return NextResponse.json({ error: "value harus berupa angka." }, { status: 422 });
  }
  if (!canAccessProject(persona, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectCode}.` }, { status: 403 });
  }

  const isBuiltin = Boolean(getBuiltinFormulaParam(projectCode, key));

  try {
    const existing = await getFormulaParameter(projectCode, key);
    const beforeValue = existing ? Number(existing.value) : isBuiltin ? getBuiltinFormulaParam(projectCode, key)!.value : null;

    await upsertFormulaParameter({
      projectCode,
      key,
      label,
      group,
      type,
      value: value.toFixed(4),
      builtin: isBuiltin,
      active: true,
      createdBy: persona.name,
    });
    await recordFormulaParameterChange({
      projectCode,
      key,
      label,
      action: existing ? "update" : "create",
      beforeValue: beforeValue === null ? null : String(beforeValue),
      afterValue: String(value),
      changedBy: persona.name,
    });
    await writeAuditLog({
      projectId: projectCode,
      category: "formula",
      action: existing ? "formula_parameter.update" : "formula_parameter.create",
      actor: persona.name,
      entityType: "formula_parameter",
      entityId: `${projectCode}:${key}`,
      detail: `${existing ? "Ubah" : "Buat"} parameter "${label}" → ${value}.`,
    });
    return NextResponse.json({ ok: true, key }, { status: existing ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan parameter (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/formula-engine — activate/deactivate a parameter.
 * Body: { projectCode, key, active }. Leader/Super Admin.
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

  const projectCode = typeof body.projectCode === "string" ? body.projectCode : "";
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const active = Boolean(body.active);

  if (!projectCode || !key) {
    return NextResponse.json({ error: "projectCode dan key wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectCode}.` }, { status: 403 });
  }

  try {
    const ok = await setFormulaParameterActive(projectCode, key, active);
    if (!ok) return NextResponse.json({ error: "Parameter tidak ditemukan." }, { status: 404 });
    await recordFormulaParameterChange({
      projectCode,
      key,
      label: key,
      action: active ? "activate" : "deactivate",
      beforeValue: null,
      afterValue: null,
      changedBy: persona.name,
    });
    await writeAuditLog({
      projectId: projectCode,
      category: "formula",
      action: active ? "formula_parameter.activate" : "formula_parameter.deactivate",
      actor: persona.name,
      entityType: "formula_parameter",
      entityId: `${projectCode}:${key}`,
      detail: active ? "Aktifkan parameter perhitungan." : "Nonaktifkan parameter perhitungan.",
    });
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}
