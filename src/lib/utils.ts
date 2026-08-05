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
