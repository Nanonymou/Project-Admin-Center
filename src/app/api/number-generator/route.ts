import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  listNumberFormats,
  upsertNumberFormat,
  setNumberFormatActive,
} from "@/db/repositories/number-format-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import {
  listNumberFormats as listConfigFormats,
  generateSample,
  tokensInPattern,
  type NumberFormat,
} from "@/lib/mock/number-format";

export const dynamic = "force-dynamic";

const VALID_RESET = new Set(["yearly", "monthly", "never"]);
const KNOWN_TOKENS = new Set(["{PREFIX}", "{YYYY}", "{YY}", "{MM}", "{DD}", "{SEQ}"]);

/** A pattern must contain {SEQ} and only use known tokens. */
function validatePattern(pattern: string): string | null {
  if (!pattern.includes("{SEQ}")) return "Pola wajib mengandung token {SEQ}.";
  for (const tok of tokensInPattern(pattern)) {
    if (!KNOWN_TOKENS.has(tok)) return `Token tidak dikenal: ${tok}.`;
  }
  return null;
}

/**
 * GET /api/number-generator — the document number formats, each with a rendered
 * sample of its next number. Falls back to the config catalogue when the DB is
 * unavailable. Any authenticated persona may read.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const rows = await listNumberFormats(false);
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      formats: rows.map((r) => {
        const fmt: NumberFormat = {
          key: r.key,
          docType: r.docType,
          label: r.label,
          prefix: r.prefix,
          pattern: r.pattern,
          seqPadding: r.seqPadding,
          resetPeriod: r.resetPeriod as NumberFormat["resetPeriod"],
          nextSeq: 1,
          active: r.active,
        };
        return { ...fmt, sample: generateSample(fmt) };
      }),
    });
  } catch {
    const formats = listConfigFormats().map((f) => ({ ...f, sample: generateSample(f) }));
    return NextResponse.json({ source: "config", count: formats.length, formats });
  }
}

/**
 * POST /api/number-generator — create/update a number format (upsert by key).
 * Body: { key, docType, label, prefix?, pattern, seqPadding?, resetPeriod? }
 * The pattern is validated (must contain {SEQ}, known tokens only). Leader/Super
 * Admin (canConfigure).
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengubah format nomor." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const docType = typeof body.docType === "string" ? body.docType.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const prefix = typeof body.prefix === "string" ? body.prefix.trim() : "";
  const pattern = typeof body.pattern === "string" ? body.pattern.trim() : "";
  const seqPaddingRaw = Number(body.seqPadding);
  const seqPadding = Number.isInteger(seqPaddingRaw) && seqPaddingRaw >= 1 && seqPaddingRaw <= 12 ? seqPaddingRaw : 4;
  const resetPeriod = typeof body.resetPeriod === "string" && VALID_RESET.has(body.resetPeriod) ? body.resetPeriod : "yearly";

  if (!key || !docType || !label || !pattern) {
    return NextResponse.json({ error: "key, docType, label, dan pattern wajib diisi." }, { status: 400 });
  }
  const patternError = validatePattern(pattern);
  if (patternError) return NextResponse.json({ error: patternError }, { status: 422 });

  try {
    await upsertNumberFormat({ key, docType, label, prefix, pattern, seqPadding, resetPeriod, active: true, createdBy: persona.name });
    await writeAuditLog({
      category: "master",
      action: "number_format.upsert",
      actor: persona.name,
      entityType: "number_format",
      entityId: key,
      detail: `Simpan format nomor ${label} (${pattern}).`,
    });
    return NextResponse.json({ ok: true, key }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/number-generator — activate/deactivate a number format.
 * Body: { key, active }. Leader/Super Admin.
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

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const active = Boolean(body.active);
  if (!key) return NextResponse.json({ error: "key wajib diisi." }, { status: 400 });

  try {
    const ok = await setNumberFormatActive(key, active);
    if (!ok) return NextResponse.json({ error: "Format tidak ditemukan." }, { status: 404 });
    await writeAuditLog({
      category: "master",
      action: active ? "number_format.activate" : "number_format.deactivate",
      actor: persona.name,
      entityType: "number_format",
      entityId: key,
      detail: active ? "Aktifkan format nomor." : "Nonaktifkan format nomor.",
    });
    return NextResponse.json({ ok: true, active });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status (database tidak tersedia)." }, { status: 503 });
  }
}
