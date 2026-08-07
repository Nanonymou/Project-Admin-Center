/**
 * Margin model per project — PRD Appendix §16.A. "Standard" aggregates
 * margin at the project level; "per_location" computes and reports margin
 * independently per location. Config-driven, keyed by project code.
 */
export type MarginModel = "standard" | "per_location";

const PROJECT_MARGIN_MODEL: Record<string, MarginModel> = {
  BUMA: "standard",
  POMALA: "standard",
  PHSS: "per_location",
  PHKT: "per_location",
};

export function getMarginModel(projectCode: string): MarginModel {
  return PROJECT_MARGIN_MODEL[projectCode] ?? "standard";
}

export function marginModelLabel(model: MarginModel): string {
  return model === "per_location" ? "Per Location" : "Standard (Project-level)";
}

/**
 * Target gross-margin percentage per project — the KPI health threshold used to
 * flag a site's status (healthy/warning/critical). Config-driven, keyed by
 * project code; unknown projects fall back to the default target.
 */
const DEFAULT_MARGIN_TARGET = 15;

const PROJECT_MARGIN_TARGET: Record<string, number> = {
  BUMA: 15,
  POMALA: 15,
  PHSS: 18,
  PHKT: 18,
};

export function getMarginTarget(projectCode?: string): number {
  if (!projectCode) return DEFAULT_MARGIN_TARGET;
  return PROJECT_MARGIN_TARGET[projectCode] ?? DEFAULT_MARGIN_TARGET;
}
