import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  listSystemParameters,
  getSystemParameter,
  validateParameterValue,
  type SystemParameter,
} from "@/lib/mock/system-parameters";
import {
  listSystemParameterOverrides,
  getSystemParameterOverride,
  upsertSystemParameter,
  recordSystemParameterChange,
} from "@/db/repositories/system-parameter-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";

export const dynamic = "force-dynamic";

/** Coerce a serialized (text) override back to the parameter's typed shape. */
function coerceValue(p: SystemParameter, raw: string): SystemParameter["value"] {
  if (p.type === "boolean") return raw === "true" || raw === "1";
  if (p.type === "number") return Number(raw);
  return raw;
}

/** Serialize a typed value to text for storage/history. */
function serialize(value: SystemParameter["value"]): string {
  return typeof value === "boolean" ? String(value) : String(value);
}

/**
 * GET /api/parameter-sistem — the effective system parameters: config-defined
 * catalogue merged with any DB overrides. Falls back to config-only when the
 * database is unavailable, so it always responds. Any authenticated persona reads.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const catalogue = listSystemParameters();
  try {
    const overrides = await listSystemParameterOverrides();
    const byKey = new Map(overrides.map((o) => [o.key, o.value]));
    const parameters = catalogue.map((p) => {
      const raw = byKey.get(p.key);
      return {
        key: p.key,
        label: p.label,
        group: p.group,
        type: p.type,
        unit: p.unit,
        description: p.description,
        min: p.min,
        max: p.max,
        options: p.options,
        value: raw !== undefined ? coerceValue(p, raw) : p.value,
        overridden: raw !== undefined,
      };
    });
    return NextResponse.json({ source: "db", count: parameters.length, parameters });
  } catch {
    const parameters = catalogue.map((p) => ({
      key: p.key,
      label: p.label,
      group: p.group,
      type: p.type,
      unit: p.unit,
      description: p.description,
      min: p.min,
      max: p.max,
      options: p.options,
      value: p.value,
      overridden: false,
    }));
    return NextResponse.json({ source: "config", count: parameters.length, parameters });
  }
}

/**
 * PATCH /api/parameter-sistem — update a single system parameter's value.
 * Body: { key, value }. The raw value is validated against the parameter's
 * declared type/bounds, then upserted and appended to the change history.
 * Authorization: Leader/Super Admin (canConfigure).
 */
export async function PATCH(req: NextRequest) {
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

  const key = typeof body.key === "string" ? body.key : "";
  const param = key ? getSystemParameter(key) : undefined;
  if (!param) {
    return NextResponse.json({ error: "Parameter tidak dikenal." }, { status: 404 });
  }

  // Normalize the incoming value to the raw string form the validator expects.
  const raw =
    param.type === "boolean"
      ? String(Boolean(body.value))
      : typeof body.value === "string"
        ? body.value
        : String(body.value ?? "");

  const validationError = validateParameterValue(param, raw);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  const serialized = serialize(coerceValue(param, raw));
  try {
    const existing = await getSystemParameterOverride(key);
    const beforeValue = existing?.value ?? serialize(param.value);
    await upsertSystemParameter(key, serialized, persona.name);
    await recordSystemParameterChange({ key, beforeValue, afterValue: serialized, changedBy: persona.name });
    await writeAuditLog({
      category: "system",
      action: "parameter.update",
      actor: persona.name,
      entityType: "system_parameter",
      entityId: key,
      detail: `Ubah "${param.label}" → ${serialized}`,
    });
    return NextResponse.json({ ok: true, key, value: coerceValue(param, serialized) });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan parameter (database tidak tersedia)." }, { status: 503 });
  }
}
