import { getApprovalTimeframes } from "@/lib/mock/approval-timeframe-config";

export type TimelineStage = {
  stage: string;
  stageOrder: number;
  slaDays: number;
  state: "pending" | "current" | "done";
  startedAt: string | null;
  completedAt: string | null;
  actualDays: number;
  breached: boolean;
};

function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build an invoice's processing timeline from the config-driven approval stages,
 * seeded deterministically per invoice so it is stable across requests. Mirrors
 * the client seeding: stages before the current index are done, one is running,
 * the rest pending; `actual_days` and `breached` reflect whether a completed
 * stage overran its SLA. Used as the mock fallback when the DB is unavailable, so
 * the timeline endpoints always respond.
 */
export function buildTimeline(projectCode: string, seedKey: string): TimelineStage[] {
  const flow = getApprovalTimeframes(projectCode, "invoice");
  if (flow.length === 0) return [];
  const seed = seedOf(seedKey);
  const currentIdx = seed % flow.length;
  const start = new Date();
  start.setDate(
    start.getDate() - flow.slice(0, currentIdx + 1).reduce((s, f) => s + f.slaDays, 0),
  );
  const cursor = new Date(start);
  return flow.map((f, i) => {
    const state: TimelineStage["state"] =
      i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
    const startedAt = new Date(cursor);
    const actualDays = state === "pending" ? 0 : Math.max(1, f.slaDays - 1 + ((seed + i) % 3));
    const completed = new Date(startedAt);
    completed.setDate(completed.getDate() + actualDays);
    cursor.setDate(cursor.getDate() + f.slaDays);
    const breached = state !== "pending" && actualDays > f.slaDays;
    return {
      stage: f.stage,
      stageOrder: f.order,
      slaDays: f.slaDays,
      state,
      startedAt: state === "pending" ? null : isoDate(startedAt),
      completedAt: state === "done" ? isoDate(completed) : null,
      actualDays,
      breached,
    };
  });
}
