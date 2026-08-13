import { NextResponse, type NextRequest } from "next/server";
import { createInvoice, listInvoices, type InvoiceFilter } from "@/db/repositories/invoice-repository";
import type { NewInvoice } from "@/db/schema";
import {
  computeInvoice,
  invoiceCalcColumns,
  parseInvoiceCalcInput,
} from "@/lib/server/services/invoice-calculation-service";
import { recordInvoiceCreated } from "@/lib/server/services/invoice-audit-service";
import { resolveFormulaOverrides } from "@/lib/server/services/formula-parameter-resolver";
import { generateNextNumber } from "@/lib/server/services/number-generator-service";
import { recordActivity } from "@/lib/server/services/activity-recorder-service";
import { authorizeDashboard, requirePersona } from "@/lib/server/rbac";
import { revalidateKpi } from "@/lib/server/kpi-cache";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

function overdueDaysOf(dueDate?: string): number {
  if (!dueDate) return 0;
  const b = new Date(`${dueDate}T00:00:00Z`).getTime();
  if (Number.isNaN(b)) return 0;
  const a = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((a - b) / 86_400_000));
}

function agingBucketOf(days: number): "0-30" | "31-60" | "61-90" | ">90" {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return ">90";
}

/**
 * GET /api/invoices?projectId=&locationId=&status=&stage=&agingBucket=&scope=
 * Lists invoices across the sites the persona may see. Falls back to mock
 * invoices when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const locationId = sp.get("locationId") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const stage = sp.get("stage") ?? undefined;
  const agingBucket = sp.get("agingBucket") ?? undefined;
  const scope = (sp.get("scope") as "tenant" | "executive" | null) ?? (projectId ? "tenant" : "executive");
  // Multi-site selection: `sites=loc1,loc2` narrows to a subset of locations.
  const siteSet = new Set(
    (sp.get("sites") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const inSiteSet = (loc: string) => siteSet.size === 0 || siteSet.has(loc);
  const filter: InvoiceFilter = { projectId, locationId, status, stage, agingBucket, scope };

  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  const authz = authorizeDashboard(persona, filter);
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }

  try {
    const rows = (await listInvoices(filter)).filter(
      (r) => canAccessLocation(persona, r.locationId, r.projectId) && inSiteSet(r.locationId),
    );
    return NextResponse.json({ source: "db", filter, count: rows.length, invoices: rows });
  } catch {
    let sites = SITE_KPI.filter((s) => canAccessLocation(persona, s.locationId, s.projectCode));
    if (projectId) sites = sites.filter((s) => s.projectCode === projectId);
    if (locationId) sites = sites.filter((s) => s.locationId === locationId);
    sites = sites.filter((s) => inSiteSet(s.locationId));
    let invoices = sites.flatMap((s) => {
      const detail = SITE_DETAILS[s.locationId];
      if (!detail) return [];
      return detail.invoices.map((inv) => ({
        projectCode: s.projectCode,
        locationId: s.locationId,
        number: inv.number,
        amount: inv.amount,
        stage: inv.stage,
        status: inv.status,
        agingBucket: inv.agingBucket,
        dueDate: inv.dueDate,
        pic: inv.pic,
      }));
    });
    if (stage) invoices = invoices.filter((i) => i.stage === stage);
    if (agingBucket) invoices = invoices.filter((i) => i.agingBucket === agingBucket);
    return NextResponse.json({ source: "mock", filter, count: invoices.length, invoices });
  }
}

/**
 * POST /api/invoices
 * Body: { projectId, locationId, number, subtotal, deduction?, issuedDate?,
 *         dueDate?, pic?, stage?, status? }
 * Creates an invoice, computing tax/penalty/total via the calculation service.
 * Viewers cannot create; the persona must have access to the target site.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat membuat invoice." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  // Number is optional: when omitted, it is auto-generated below via the
  // Automatic Number Generator (invoice format) after the access checks pass.
  let number = typeof body.number === "string" ? body.number.trim() : "";

  // Validate & resolve the financial inputs (subtotal/deduction/bbm + optional
  // invoice type) through the shared server calculation validator; the invoice
  // type profile supplies deduction/BBM defaults, mirroring /api/invoices/calculate.
  const parsed = parseInvoiceCalcInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const { projectCode: projectId, subtotal, deduction, bbm } = parsed.value;

  if (!locationId) {
    return NextResponse.json({ error: "locationId wajib diisi." }, { status: 400 });
  }

  const authz = authorizeDashboard(persona, { projectId, locationId, scope: "tenant" });
  if (!authz.ok) {
    return NextResponse.json({ error: authz.message, role: persona.role }, { status: authz.status });
  }
  if (!canAccessLocation(persona, locationId, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Auto-generate the invoice number when the client did not supply one, claiming
  // the next value from the Automatic Number Generator's `invoice` format.
  if (!number) {
    const generated = await generateNextNumber("invoice");
    if (!generated) {
      return NextResponse.json(
        { error: "number wajib diisi (format nomor invoice tidak tersedia)." },
        { status: 400 },
      );
    }
    number = generated.number;
  }

  const dueDate = typeof body.dueDate === "string" ? body.dueDate : undefined;
  const issuedDate = typeof body.issuedDate === "string" ? body.issuedDate : undefined;
  const pic = typeof body.pic === "string" ? body.pic : undefined;
  // Overdue days is derived from the due date at save time (not the raw input).
  const overdueDays = overdueDaysOf(dueDate);
  // Apply the project's Formula Engine parameter overrides to this new invoice's
  // calculation (config defaults when none configured / DB unavailable).
  const overrides = await resolveFormulaOverrides(projectId);
  const calc = computeInvoice({ projectCode: projectId, subtotal, deduction, bbm, overdueDays }, overrides);

  const STATUSES: NewInvoice["status"][] = ["on_time", "at_risk", "overdue", "settled"];
  const STAGES: NewInvoice["stage"][] = [
    "Verifikasi Site",
    "Approval Leader",
    "Verifikasi Finance",
    "Kirim Client",
    "Payment",
  ];
  const status = STATUSES.includes(body.status as NewInvoice["status"])
    ? (body.status as NewInvoice["status"])
    : "on_time";
  const stage = STAGES.includes(body.stage as NewInvoice["stage"])
    ? (body.stage as NewInvoice["stage"])
    : "Verifikasi Site";

  const values: NewInvoice = {
    projectId,
    locationId,
    number,
    ...invoiceCalcColumns(calc, overdueDays),
    status,
    stage,
    agingBucket: agingBucketOf(overdueDays),
    issuedDate,
    dueDate,
    pic,
    createdBy: persona.name,
  };

  try {
    const invoice = await createInvoice(values);
    // Best-effort audit trail — never fail the create because logging failed.
    try {
      await recordInvoiceCreated(
        { ...invoice, number: invoice.number },
        persona.name,
        persona.role,
      );
    } catch {
      /* audit logging is best-effort */
    }
    // Operational activity feed (Activity Log) — best-effort.
    await recordActivity(persona, {
      action: "create",
      target: `Invoice ${invoice.number}`,
      projectCode: projectId,
      locationId,
      detail: `Invoice ${invoice.number} dibuat (total ${calc.total}).`,
    });
    revalidateKpi();
    return NextResponse.json({ source: "db", invoice, calc }, { status: 201 });
  } catch (err) {
    revalidateKpi();
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Invoice dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      invoice: values,
      calc,
    });
  }
}
