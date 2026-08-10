import { NextResponse, type NextRequest } from "next/server";
import { computeInvoice } from "@/lib/server/services/invoice-calculation-service";
import { getInvoiceType, isInvoiceType, listInvoiceTypes } from "@/lib/mock/invoice-type-config";
import { getBbmConfig } from "@/lib/mock/bbm-config";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";

export const dynamic = "force-dynamic";

/**
 * GET /api/invoices/calculate — lists the configured invoice types so the client
 * can render a type selector without hard-coding the profiles.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  return NextResponse.json({ types: listInvoiceTypes() });
}

/**
 * POST /api/invoices/calculate — pure invoice calculation keyed on invoice type.
 * Body: { projectCode (or projectId), invoiceType, subtotal, deduction?, bbm?,
 *         overdueDays? }
 *
 * The invoice type profiles derive sensible defaults (deduction as a fraction of
 * the subtotal; BBM surcharge when the type carries one AND the project's BBM
 * config enables it). Explicit `deduction`/`bbm` in the body override the
 * profile defaults. Tax and penalty always come from the per-project config via
 * `computeInvoice` — no project-named branches. No persistence: this only
 * returns the breakdown, so any persona with access to the project may call it.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode =
    typeof body.projectCode === "string"
      ? body.projectCode
      : typeof body.projectId === "string"
        ? body.projectId
        : "";
  if (!projectCode) {
    return NextResponse.json({ error: "projectCode wajib diisi." }, { status: 400 });
  }
  if (!canAccessProject(persona, projectCode)) {
    return NextResponse.json(
      { error: `Tidak ada akses ke project ${projectCode}.`, role: persona.role },
      { status: 403 },
    );
  }

  const subtotal = Number(body.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return NextResponse.json({ error: "subtotal wajib berupa angka >= 0." }, { status: 400 });
  }

  const typeKey = typeof body.invoiceType === "string" ? body.invoiceType : "";
  if (typeKey && !isInvoiceType(typeKey)) {
    return NextResponse.json(
      { error: `Jenis invoice tidak dikenal: ${typeKey}.`, types: listInvoiceTypes().map((t) => t.key) },
      { status: 400 },
    );
  }
  const profile = getInvoiceType(typeKey);

  // Deduction: explicit body value wins, else derived from the type profile.
  const deduction = Number.isFinite(Number(body.deduction))
    ? Math.max(0, Number(body.deduction))
    : Math.round(subtotal * profile.deductionRate);

  // BBM: only meaningful when the type carries one and the project's config
  // enables it. Explicit body value wins over the profile-derived default.
  const bbmApplies = profile.hasBbm && getBbmConfig(projectCode).applies;
  const bbm = Number.isFinite(Number(body.bbm))
    ? Math.max(0, Number(body.bbm))
    : bbmApplies
      ? Math.round(subtotal * profile.bbmRate)
      : 0;

  const overdueDays = Number.isFinite(Number(body.overdueDays))
    ? Math.max(0, Math.floor(Number(body.overdueDays)))
    : 0;

  const calc = computeInvoice({ projectCode, subtotal, deduction, bbm, overdueDays });

  return NextResponse.json({
    projectCode,
    invoiceType: { key: profile.key, label: profile.label },
    input: { subtotal, deduction, bbm, overdueDays, bbmApplies },
    calc,
  });
}
