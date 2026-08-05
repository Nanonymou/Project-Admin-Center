/**
 * Configuration-driven tax matrix — PRD Appendix §16.D (Formula Matrix).
 * Keyed by project code so business rules stay data, not hardcoded ifs.
 * A new project only needs a row here (or, in the real system, a DB row).
 */
export type TaxConfig = {
  code: string; // e.g. "PPN", "PB1"
  label: string;
  rate: number; // fractional, e.g. 0.11
};

export const PROJECT_TAX_CONFIG: Record<string, TaxConfig> = {
  BUMA: { code: "PPN", label: "PPN 11%", rate: 0.11 },
  POMALA: { code: "PPN", label: "PPN 11%", rate: 0.11 },
  PHSS: { code: "PB1", label: "PB1 10%", rate: 0.1 },
  PHKT: { code: "PB1", label: "PB1 10%", rate: 0.1 },
};

export const DEFAULT_TAX: TaxConfig = { code: "PPN", label: "PPN 11%", rate: 0.11 };

export function getTaxConfig(projectCode: string): TaxConfig {
  return PROJECT_TAX_CONFIG[projectCode] ?? DEFAULT_TAX;
}
