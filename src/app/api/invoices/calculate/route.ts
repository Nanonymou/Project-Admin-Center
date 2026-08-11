import { NextResponse, type NextRequest } from "next/server";
import {
  computeInvoice,
  parseInvoiceCalcInput,
} from "@/lib/server/services/invoice-calculation-service";
import { listInvoiceTypes } from "@/lib/mock/invoice-type-config";
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

  const parsed = parseInvoiceCalcInput(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, types: listInvoiceTypes().map((t) => t.key) },
      { status: parsed.status },
    );
  }
  const { projectCode, invoiceType, subtotal, deduction, bbm, overdueDays, bbmApplies } = parsed.value;

  if (!canAccessProject(persona, projectCode)) {
    return NextResponse.json(
      { error: `Tidak ada akses ke project ${projectCode}.`, role: persona.role },
      { status: 403 },
    );
  }

  const calc = computeInvoice({ projectCode, subtotal, deduction, bbm, overdueDays });

  return NextResponse.json({
    projectCode,
    invoiceType,
    input: { subtotal, deduction, bbm, overdueDays, bbmApplies },
    calc,
  });
}
