/**
 * BBM (fuel) surcharge configuration per project (config-driven, keyed by
 * project code). Some projects (e.g. remote oil & gas sites) bill a BBM
 * surcharge on top of the service value; others do not. `taxable` controls
 * whether the surcharge is part of the taxable base. Unknown projects fall back
 * to "no BBM".
 */
export type BbmConfig = {
  applies: boolean;
  taxable: boolean;
};

const DEFAULT_BBM: BbmConfig = { applies: false, taxable: true };

const PROJECT_BBM: Record<string, BbmConfig> = {
  BUMA: { applies: false, taxable: true },
  POMALA: { applies: false, taxable: true },
  PHSS: { applies: false, taxable: true },
  PHKT: { applies: true, taxable: true },
};

export function getBbmConfig(projectCode: string): BbmConfig {
  return PROJECT_BBM[projectCode] ?? DEFAULT_BBM;
}
