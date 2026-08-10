import { NextResponse, type NextRequest } from "next/server";
import {
  deleteInvoice,
  getInvoiceById,
  updateInvoice,
} from "@/db/repositories/invoice-repository";
import type { NewInvoice } from "@/db/schema";
import { computeInvoice, invoiceCalcColumns } from "@/lib/server/services/invoice-calculation-service";
import {
  recordInvoiceEdited,
  recordStageTransition,
} from "@/lib/server/services/invoice-audit-service";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation, type Persona } from "@/lib/personas";

export const dynamic = "force-dynamic";

async function loadAndAuthorize(id: string, persona: Persona) {
  const existing = await getInvoiceById(id);
  if (!existing) return { ok: false as const, status: 404, message: "Invoice tidak ditemukan." };
  if (!canAccessLocation(persona, existing.locationId, existing.projectId)) {
    return { ok: false as const, status: 403, message: "Tidak ada akses ke invoice ini." };
  }
  const authz = authorizeDashboard(persona, {
    projectId: existing.projectId,
    locationId: existing.locationId,
    scope: "tenant",
  });
  if (!authz.ok) return { ok: false as const, status: authz.status, message: authz.message };
  return { ok: true as const, existing };
}

/** GET /api/invoices/:id */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const existing = await getInvoiceById(id);
    if (!existing) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(auth.persona, existing.locationId, existing.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke invoice ini." }, { status: 403 });
    }
    // Recompute the Formula Engine breakdown from the stored inputs so callers
    // get the full derivation without re-implementing it.
    const calc = computeInvoice({
      projectCode: existing.projectId,
      subtotal: Number(existing.subtotal),
      deduction: Number(existing.deduction),
      bbm: Number(existing.bbmAmount),
      overdueDays: existing.overdueDays ?? 0,
    });
    return NextResponse.json({ source: "db", invoice: existing, calc });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/** PATCH /api/invoices/:id — update fields; recomputes totals when subtotal/deduction change. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah invoice." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  try {
    const loaded = await loadAndAuthorize(id, persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const existing = loaded.existing;

    const patch: Partial<NewInvoice> = {};
    if (typeof body.stage === "string") patch.stage = body.stage as NewInvoice["stage"];
    if (typeof body.status === "string") patch.status = body.status as NewInvoice["status"];
    if (typeof body.pic === "string") patch.pic = body.pic;
    if (typeof body.dueDate === "string") patch.dueDate = body.dueDate;
    if (typeof body.issuedDate === "string") patch.issuedDate = body.issuedDate;

    // Recompute financials when the taxable inputs change.
    const subtotal = Number(body.subtotal);
    const deduction = Number(body.deduction);
    const bbm = Number(body.bbm);
    if (Number.isFinite(subtotal) || Number.isFinite(deduction) || Number.isFinite(bbm)) {
      const base = Number.isFinite(subtotal) ? subtotal : Number(existing.subtotal);
      const ded = Number.isFinite(deduction) ? deduction : Number(existing.deduction);
      // Preserve the existing BBM amount when the caller doesn't restate it.
      const bbmAmt = Number.isFinite(bbm) ? bbm : Number(existing.bbmAmount);
      const overdueDays = existing.overdueDays ?? 0;
      const calc = computeInvoice({
        projectCode: existing.projectId,
        subtotal: base,
        deduction: ded,
        bbm: bbmAmt,
        overdueDays,
      });
      Object.assign(patch, invoiceCalcColumns(calc, overdueDays));
    }

    const updated = await updateInvoice(id, patch);
    if (!updated) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });

    // Record the audit trail — a stage move is a distinct workflow event; any
    // other field change is an edit. Best-effort: never fail the update on log error.
    try {
      if (patch.stage && patch.stage !== existing.stage) {
        await recordStageTransition(updated, persona.name, existing.stage, patch.stage, persona.role);
      }
      const editedFields = Object.keys(patch).filter((f) => f !== "stage" && f !== "updatedAt");
      if (editedFields.length > 0) {
        await recordInvoiceEdited(updated, persona.name, editedFields, persona.role);
      }
    } catch {
      /* audit logging is best-effort */
    }

    revalidateKpi();
    return NextResponse.json({ source: "db", invoice: updated });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}

/** DELETE /api/invoices/:id */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat menghapus invoice." }, { status: 403 });
  }

  try {
    const loaded = await loadAndAuthorize(id, persona);
    if (!loaded.ok) return NextResponse.json({ error: loaded.message }, { status: loaded.status });
    const removed = await deleteInvoice(id, persona.name);
    revalidateKpi();
    return NextResponse.json({ source: "db", deleted: removed });
  } catch {
    return NextResponse.json({ error: "Database tidak tersedia." }, { status: 503 });
  }
}
