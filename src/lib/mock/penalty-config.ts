/**
 * Late-payment penalty configuration per project (config-driven, keyed by
 * project code). `monthlyRate` is applied per started month overdue beyond the
 * grace window; `graceDays` are ignored before any penalty accrues. Unknown
 * projects fall back to the default.
 */
export type PenaltyConfig = {
  monthlyRate: number; // fractional, e.g. 0.02 = 2% per month
  graceDays: number;
};

const DEFAULT_PENALTY: PenaltyConfig = { monthlyRate: 0.02, graceDays: 0 };

const PROJECT_PENALTY: Record<string, PenaltyConfig> = {
  BUMA: { monthlyRate: 0.02, graceDays: 0 },
  POMALA: { monthlyRate: 0.02, graceDays: 0 },
  PHSS: { monthlyRate: 0.015, graceDays: 7 },
  PHKT: { monthlyRate: 0.015, graceDays: 7 },
};

export function getPenaltyConfig(projectCode: string): PenaltyConfig {
  return PROJECT_PENALTY[projectCode] ?? DEFAULT_PENALTY;
}
