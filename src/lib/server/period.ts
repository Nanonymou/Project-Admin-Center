import { getInvoicePeriodRange } from "@/lib/mock/cutoff-config";

export type ResolvedPeriod = { from?: string; to?: string; label: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Resolve dashboard period parameters from a query string.
 * Priority: `period` preset > explicit `from`/`to` > unbounded.
 * Calendar presets: 7d, 30d, 90d, this-month, last-month, ytd.
 * Cut-off-period presets (`current-period`, `last-period`) resolve against the
 * project's invoice cut-off window (§16.A) and therefore require `projectCode`;
 * without it they degrade to the default 30-day window.
 */
export function parsePeriod(
  sp: URLSearchParams,
  ref = new Date(),
  projectCode?: string,
): ResolvedPeriod {
  const preset = sp.get("period");
  if (preset) return resolvePreset(preset, ref, projectCode);

  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");
  const from = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : undefined;
  const to = toRaw && DATE_RE.test(toRaw) ? toRaw : undefined;
  if (from || to) return { from, to, label: `${from ?? "…"} → ${to ?? "…"}` };

  return { label: "Semua periode" };
}

function resolvePreset(preset: string, ref: Date, projectCode?: string): ResolvedPeriod {
  // Cut-off-aware periods are config-driven per project; they need a project.
  if ((preset === "current-period" || preset === "last-period") && projectCode) {
    const r = getInvoicePeriodRange(projectCode, ref, preset === "current-period" ? 0 : -1);
    const label = preset === "current-period" ? "Periode berjalan" : "Periode lalu";
    return { from: r.from, to: r.to, label: `${label} (${r.label})` };
  }

  const to = new Date(ref);
  const from = new Date(ref);
  switch (preset) {
    case "7d":
      from.setDate(from.getDate() - 7);
      return { from: iso(from), to: iso(to), label: "7 hari terakhir" };
    case "90d":
      from.setDate(from.getDate() - 90);
      return { from: iso(from), to: iso(to), label: "90 hari terakhir" };
    case "this-month":
      from.setDate(1);
      return { from: iso(from), to: iso(to), label: "Bulan ini" };
    case "last-month": {
      const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
      return { from: iso(start), to: iso(end), label: "Bulan lalu" };
    }
    case "ytd":
      return { from: `${ref.getFullYear()}-01-01`, to: iso(to), label: "Year to date" };
    case "30d":
    default:
      from.setDate(from.getDate() - 30);
      return { from: iso(from), to: iso(to), label: "30 hari terakhir" };
  }
}
