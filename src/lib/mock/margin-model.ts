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
