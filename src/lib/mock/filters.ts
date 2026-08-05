import { MOCK_WORKSPACES } from "./workspaces";

export type ProjectOption = {
  code: string;
  name: string;
};

export type LocationOption = {
  id: string;
  name: string;
  projectCode: string;
};

export const PROJECT_OPTIONS: ProjectOption[] = Array.from(
  new Map(
    MOCK_WORKSPACES.map((w) => [w.projectCode, { code: w.projectCode, name: w.projectName }]),
  ).values(),
);

export const LOCATION_OPTIONS: LocationOption[] = MOCK_WORKSPACES.map((w) => ({
  id: w.locationId,
  name: w.locationName,
  projectCode: w.projectCode,
}));

export const DATE_PRESETS = [
  { key: "today", label: "Hari Ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "7d", label: "7 Hari Terakhir" },
  { key: "30d", label: "30 Hari Terakhir" },
  { key: "mtd", label: "Bulan Berjalan" },
  { key: "custom", label: "Custom" },
] as const;

export type DatePresetKey = (typeof DATE_PRESETS)[number]["key"];

export type ActivityFilterState = {
  preset: DatePresetKey;
  from: string;
  to: string;
  projects: string[];
  locations: string[];
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rangeForPreset(preset: DatePresetKey, reference = new Date()): { from: string; to: string } {
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  const to = isoDate(today);
  switch (preset) {
    case "today":
      return { from: to, to };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const yStr = isoDate(y);
      return { from: yStr, to: yStr };
    }
    case "7d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 6);
      return { from: isoDate(f), to };
    }
    case "30d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 29);
      return { from: isoDate(f), to };
    }
    case "mtd": {
      const f = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: isoDate(f), to };
    }
    case "custom":
      return { from: to, to };
  }
}

export const DEFAULT_FILTER_STATE: ActivityFilterState = {
  preset: "today",
  ...rangeForPreset("today"),
  projects: [],
  locations: [],
};
