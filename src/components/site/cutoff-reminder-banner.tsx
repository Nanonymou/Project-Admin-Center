"use client";

import { AlarmClock, AlertTriangle, CalendarClock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysUntilCutOff, getCutOffDate } from "@/lib/mock/cutoff-config";

/**
 * Cut-off reminder banner for the Site dashboard (Reminder Cut-Off Otomatis).
 * A prominent, always-visible strip that surfaces how many days remain until the
 * site's invoice cut-off, escalating its tone as the deadline nears — so a Site
 * Admin can't miss an approaching (or passed) cut-off. Config-driven from the
 * project's invoice period; no backend required.
 */
export function CutoffReminderBanner({
  projectCode,
  locationName,
}: {
  projectCode: string;
  locationName: string;
}) {
  const days = daysUntilCutOff(projectCode);
  const cutOff = getCutOffDate(projectCode);
  const cutOffLabel = cutOff.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const tone =
    days < 0
      ? {
          className: "border-rose-200 bg-rose-50 text-rose-900",
          icon: Lock,
          title: `Cut-off terlewat ${Math.abs(days)} hari`,
          message: "Periode sudah melewati cut-off — segera koordinasi untuk penguncian.",
        }
      : days === 0
        ? {
            className: "border-rose-200 bg-rose-50 text-rose-900",
            icon: AlertTriangle,
            title: "Hari ini cut-off!",
            message: "Pastikan seluruh entri harian sudah disubmit sebelum penguncian.",
          }
        : days <= 3
          ? {
              className: "border-amber-200 bg-amber-50 text-amber-900",
              icon: AlarmClock,
              title: `Cut-off ${days} hari lagi`,
              message: "Segera lengkapi dan submit entri agar tidak terkunci.",
            }
          : {
              className: "border-sky-200 bg-sky-50 text-sky-900",
              icon: CalendarClock,
              title: `Cut-off ${days} hari lagi`,
              message: "Periode berjalan sesuai jadwal.",
            };

  const Icon = tone.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", tone.className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {tone.title} <span className="font-normal opacity-80">· {locationName}</span>
        </p>
        <p className="mt-0.5 text-xs opacity-90">
          {tone.message} Tanggal cut-off: <b>{cutOffLabel}</b>.
        </p>
      </div>
    </div>
  );
}
