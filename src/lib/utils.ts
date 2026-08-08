import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency: string = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

/**
 * Compact Rupiah, e.g. Rp 1,3 M / Rp 850 jt / Rp 12 rb. Handy for dense
 * KPI tiles where the full currency string would overflow.
 */
export function formatCurrencyCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const fmt = (n: number, digits = 1) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits }).format(n);
  if (abs >= 1_000_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000_000)} T`;
  if (abs >= 1_000_000_000) return `${sign}Rp ${fmt(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp ${fmt(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}Rp ${fmt(abs / 1_000, 0)} rb`;
  return `${sign}Rp ${fmt(abs, 0)}`;
}

const TERBILANG_UNITS = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

/** Convert a non-negative integer < 1000 into Indonesian words. */
function terbilangBelowThousand(n: number): string {
  if (n < 12) return TERBILANG_UNITS[n];
  if (n < 20) return `${TERBILANG_UNITS[n - 10]} belas`;
  if (n < 100) {
    const tens = Math.floor(n / 10);
    return `${TERBILANG_UNITS[tens]} puluh ${TERBILANG_UNITS[n % 10]}`.trim();
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const prefix = hundreds === 1 ? "seratus" : `${TERBILANG_UNITS[hundreds]} ratus`;
  return `${prefix} ${terbilangBelowThousand(rest)}`.trim();
}

/**
 * Spell a Rupiah amount in Indonesian words ("terbilang"), e.g.
 * 1.250.000 → "satu juta dua ratus lima puluh ribu rupiah". Rounds to whole
 * Rupiah and handles negatives. Used to annotate totals on transaction forms.
 */
export function terbilang(value: number): string {
  const rounded = Math.round(Math.abs(value));
  if (rounded === 0) return "nol rupiah";

  const scales: [number, string][] = [
    [1_000_000_000_000, "triliun"],
    [1_000_000_000, "miliar"],
    [1_000_000, "juta"],
    [1_000, "ribu"],
  ];

  let remainder = rounded;
  const parts: string[] = [];
  for (const [scale, name] of scales) {
    if (remainder >= scale) {
      const count = Math.floor(remainder / scale);
      remainder %= scale;
      // "seribu" is a special case for exactly one thousand.
      if (scale === 1000 && count === 1) {
        parts.push("seribu");
      } else {
        parts.push(`${terbilangBelowThousand(count)} ${name}`);
      }
    }
  }
  if (remainder > 0) parts.push(terbilangBelowThousand(remainder));

  const words = parts.join(" ").replace(/\s+/g, " ").trim();
  const sign = value < 0 ? "minus " : "";
  return `${sign}${words} rupiah`;
}

export function formatDate(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
