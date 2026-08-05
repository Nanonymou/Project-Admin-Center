import type { InvoiceTimeline, TimelineStageState } from "./approval-timeline";

export type ActivityEventType = "submit" | "approve" | "reject" | "verify" | "send" | "reminder" | "payment";

export type TimelineActivityEvent = {
  id: string;
  type: ActivityEventType;
  stage: string;
  actor: string;
  dateLabel: string;
  offsetDays: number;
  note: string;
};

const EVENT_LABEL: Record<ActivityEventType, string> = {
  submit: "Invoice disubmit",
  verify: "Verifikasi dokumen",
  approve: "Disetujui",
  reject: "Dikembalikan untuk perbaikan",
  send: "Dikirim ke client",
  reminder: "Reminder SLA dikirim",
  payment: "Pembayaran diterima",
};

export function activityEventLabel(type: ActivityEventType) {
  return EVENT_LABEL[type];
}

function rand(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function eventTypeForStage(stage: string): ActivityEventType {
  switch (stage) {
    case "Verifikasi Site":
      return "submit";
    case "Approval Leader":
      return "approve";
    case "Verifikasi Finance":
      return "verify";
    case "Kirim Client":
      return "send";
    case "Payment":
      return "payment";
    default:
      return "verify";
  }
}

function dateLabelFromOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(0, offsetDays));
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Expand a per-invoice timeline into a chronological activity feed:
 * one entry per completed/active stage, plus reminder/reject noise for
 * at-risk and overdue stages. Offsets are measured backward from "today".
 */
export function buildTimelineActivity(timeline: InvoiceTimeline): TimelineActivityEvent[] {
  const events: TimelineActivityEvent[] = [];
  const totalSpan = timeline.totalElapsedDays;
  let seq = 0;

  for (const stage of timeline.stages) {
    if (stage.state === "upcoming") continue;
    const enterOffset = totalSpan - stage.startOffset;
    events.push({
      id: `${timeline.invoiceNumber}-${stage.stage}-enter-${seq++}`,
      type: eventTypeForStage(stage.stage),
      stage: stage.stage,
      actor: stage.actor,
      dateLabel: dateLabelFromOffset(enterOffset),
      offsetDays: enterOffset,
      note: `${activityEventLabel(eventTypeForStage(stage.stage))} pada tahap ${stage.stage}.`,
    });

    if (stage.breachedSla) {
      const remindOffset = enterOffset - Math.round(stage.slaDays);
      events.push({
        id: `${timeline.invoiceNumber}-${stage.stage}-reminder-${seq++}`,
        type: "reminder",
        stage: stage.stage,
        actor: "System",
        dateLabel: dateLabelFromOffset(remindOffset),
        offsetDays: remindOffset,
        note: `SLA ${stage.slaDays} hari terlampaui — reminder eskalasi dikirim.`,
      });
    }

    if (stage.state === "overdue" && rand(seq) > 0.6) {
      events.push({
        id: `${timeline.invoiceNumber}-${stage.stage}-reject-${seq++}`,
        type: "reject",
        stage: stage.stage,
        actor: stage.actor,
        dateLabel: dateLabelFromOffset(Math.max(0, enterOffset - 1)),
        offsetDays: Math.max(0, enterOffset - 1),
        note: "Dokumen dikembalikan untuk perbaikan sebelum lanjut.",
      });
    }
  }

  return events.sort((a, b) => b.offsetDays - a.offsetDays);
}

// --- Status helpers ---

export function stageStateLabel(state: TimelineStageState): string {
  switch (state) {
    case "done":
      return "Selesai";
    case "current":
      return "Berjalan";
    case "overdue":
      return "Overdue";
    default:
      return "Belum mulai";
  }
}

export function timelineHealth(timeline: InvoiceTimeline): "sehat" | "pantau" | "kritis" {
  const breaches = timeline.stages.filter((s) => s.breachedSla).length;
  if (timeline.status === "overdue" || breaches >= 2) return "kritis";
  if (timeline.status === "atRisk" || breaches === 1) return "pantau";
  return "sehat";
}

export function completedStageCount(timeline: InvoiceTimeline): number {
  return timeline.stages.filter((s) => s.state === "done").length;
}
