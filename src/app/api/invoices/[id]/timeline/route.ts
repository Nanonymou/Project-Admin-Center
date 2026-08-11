import { NextResponse, type NextRequest } from "next/server";
import { getInvoiceById } from "@/db/repositories/invoice-repository";
import {
  listStageProgressForInvoice,
  upsertStageProgress,
} from "@/db/repositories/invoice-stage-progress-repository";
import type { NewInvoiceStageProgress } from "@/db/schema";
import { buildTimeline, buildTimelineFromFlow } from "@/lib/server/services/invoice-timeline-service";
import { recordInvoiceActivity } from "@/lib/server/services/invoice-audit-service";
import { resolveTimeframes } from "@/lib/server/services/master-timeframe-service";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { SITE_DETAILS } from "@/lib/mock/site-detail";

export const dynamic = "force-dynamic";

const STATES = ["pending", "current", "done"] as const;
type StageState = (typeof STATES)[number];

/** Whole-days between two ISO dates (>= 0), or 0 when either is missing. */
function daysBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * GET /api/invoices/:id/timeline
 * The invoice's processing timeline — its stage-progress rows in order. When no
 * persisted progress exists (or the DB is unavailable), the timeline is
 * synthesized from the config-driven approval stages so the page always renders.
 * Enforces that the persona may access the invoice's site.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  try {
    const invoice = await getInvoiceById(id);
    if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, invoice.locationId, invoice.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke invoice ini." }, { status: 403 });
    }
    const rows = await listStageProgressForInvoice(id);
    if (rows.length > 0) {
      return NextResponse.json({ source: "db", invoiceId: id, count: rows.length, stages: rows });
    }
    // No persisted progress yet — synthesize from the Master-Timeframe-resolved flow.
    const flow = await resolveTimeframes(invoice.projectId, "invoice");
    const stages = buildTimelineFromFlow(flow, `${invoice.locationId}-${invoice.number}`);
    return NextResponse.json({ source: "config", invoiceId: id, count: stages.length, stages });
  } catch {
    // Mock fallback: locate the invoice by its "<locationId>-<number>" id.
    for (const site of SITE_KPI) {
      if (!canAccessLocation(persona, site.locationId, site.projectCode)) continue;
      const detail = SITE_DETAILS[site.locationId];
      if (!detail) continue;
      const inv = detail.invoices.find((i) => `${site.locationId}-${i.number}` === id);
      if (!inv) continue;
      const stages = buildTimeline(site.projectCode, `${site.locationId}-${inv.number}`);
      return NextResponse.json({ source: "mock", invoiceId: id, count: stages.length, stages });
    }
    return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }
}

/**
 * PATCH /api/invoices/:id/timeline
 * Body: { stage, state?, startedAt?, completedAt?, actualDays?, docCount? }
 * Updates a single stage's actual dates and progress on the invoice's timeline
 * (upsert per invoice+stage). `sla_days`/`stage_order` are resolved from the
 * config-driven flow; `breached` is recomputed from actual vs SLA; `actual_days`
 * derives from the started/completed dates when not supplied. Viewers cannot
 * update; the persona must have access to the invoice's site.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role === "viewer") {
    return NextResponse.json({ error: "Viewer tidak dapat mengubah timeline." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const stage = typeof body.stage === "string" ? body.stage : "";
  if (!stage) return NextResponse.json({ error: "stage wajib diisi." }, { status: 400 });

  const state = STATES.includes(body.state as StageState) ? (body.state as StageState) : undefined;
  const startedAt = typeof body.startedAt === "string" ? body.startedAt : undefined;
  const completedAt = typeof body.completedAt === "string" ? body.completedAt : undefined;
  const docCount = Number.isFinite(Number(body.docCount)) ? Math.max(0, Math.floor(Number(body.docCount))) : undefined;

  try {
    const invoice = await getInvoiceById(id);
    if (!invoice) return NextResponse.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
    if (!canAccessLocation(persona, invoice.locationId, invoice.projectId)) {
      return NextResponse.json({ error: "Tidak ada akses ke invoice ini." }, { status: 403 });
    }

    // Resolve SLA + order from the Master-Timeframe-resolved flow for this stage.
    const flow = await resolveTimeframes(invoice.projectId, "invoice");
    const idx = flow.findIndex((f) => f.stage === stage);
    if (idx === -1) {
      return NextResponse.json({ error: `Stage tidak dikenal: ${stage}.` }, { status: 400 });
    }
    const slaDays = flow[idx].slaDays;
    const resolvedState: StageState = state ?? "current";

    // Actual duration: explicit value wins, else derived from the dates.
    const actualDays = Number.isFinite(Number(body.actualDays))
      ? Math.max(0, Math.floor(Number(body.actualDays)))
      : daysBetween(startedAt, completedAt);
    const breached = resolvedState !== "pending" && actualDays > slaDays;

    const values: NewInvoiceStageProgress = {
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      locationId: invoice.locationId,
      stage,
      stageOrder: flow[idx].order,
      slaDays,
      state: resolvedState,
      startedAt: startedAt ?? null,
      completedAt: completedAt ?? null,
      actualDays,
      breached,
      pic: invoice.pic ?? undefined,
      docCount: docCount ?? 0,
      createdBy: persona.name,
    };
    const row = await upsertStageProgress(values);

    // Best-effort audit trail of the timeline edit.
    try {
      await recordInvoiceActivity({
        invoice,
        action: "edit",
        actor: persona.name,
        role: persona.role,
        toStage: stage,
        detail: `Timeline tahap "${stage}" diperbarui (${resolvedState}${breached ? ", lewat SLA" : ""}).`,
        metadata: { stage, state: resolvedState, startedAt, completedAt, actualDays, breached },
      });
    } catch {
      /* audit logging is best-effort */
    }

    return NextResponse.json({ source: "db", invoiceId: id, stage: row });
  } catch (err) {
    return NextResponse.json(
      {
        source: "mock",
        simulated: true,
        message: "Perubahan timeline dicatat secara simulasi (database tidak tersedia).",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 202 },
    );
  }
}
