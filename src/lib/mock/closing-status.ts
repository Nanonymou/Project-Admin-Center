import type { SiteKpi } from "./site-kpi";

/** Daily Closing Workflow states — PRD Fase 2. */
export const CLOSING_STATES = ["draft", "submitted", "reviewed", "approved", "locked"] as const;
export type ClosingState = (typeof CLOSING_STATES)[number];

export const CLOSING_STATE_META: Record<
  ClosingState,
  { label: string; variant: "muted" | "info" | "warning" | "success"; step: number }
> = {
  draft: { label: "Draft", variant: "muted", step: 1 },
  submitted: { label: "Submitted", variant: "info", step: 2 },
  reviewed: { label: "Reviewed", variant: "warning", step: 3 },
  approved: { label: "Approved", variant: "success", step: 4 },
  locked: { label: "Locked", variant: "success", step: 5 },
};

export type SiteSubmitStatus = {
  locationId: string;
  locationName: string;
  projectCode: string;
  costState: ClosingState;
  salesState: ClosingState;
  lastUpdated: string;
  entriesToday: number;
  submittedBy: string;
};

function pickState(seed: number): ClosingState {
  const x = Math.abs(Math.sin(seed) * 10000);
  const idx = Math.floor((x - Math.floor(x)) * CLOSING_STATES.length);
  return CLOSING_STATES[Math.min(CLOSING_STATES.length - 1, idx)];
}

function seedOf(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff;
  return Math.abs(h);
}

export function buildSubmitStatus(sites: SiteKpi[]): SiteSubmitStatus[] {
  return sites.map((s) => {
    const seed = seedOf(s.locationId);
    const owner =
      s.projectCode === "BUMA"
        ? "Bagas Wicaksono"
        : s.projectCode === "POMALA"
          ? "Ika Rahmawati"
          : s.projectCode === "PHSS"
            ? "Fajar Nugraha"
            : "Dinda Ayu";
    const d = new Date();
    d.setHours(d.getHours() - (seed % 12));
    return {
      locationId: s.locationId,
      locationName: s.locationName,
      projectCode: s.projectCode,
      costState: pickState(seed),
      salesState: pickState(seed + 5),
      lastUpdated: d.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      entriesToday: 3 + (seed % 8),
      submittedBy: owner,
    };
  });
}
