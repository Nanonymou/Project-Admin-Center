"use client";

import { Lock, ShieldCheck, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Persona } from "@/lib/personas";

const TONE: Record<Persona["role"], { className: string; icon: React.ReactNode; label: string }> = {
  super_admin: {
    className: "border-primary/30 bg-primary/5 text-primary",
    icon: <ShieldCheck className="h-4 w-4" />,
    label: "Akses penuh — Anda melihat seluruh project & location.",
  },
  leader_admin: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: <ShieldCheck className="h-4 w-4" />,
    label: "Leader Admin — akses lintas project sesuai penugasan.",
  },
  site_admin: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: <Lock className="h-4 w-4" />,
    label: "Site Admin — hanya melihat data site Anda; data site lain tersembunyi.",
  },
  viewer: {
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: <ShieldQuestion className="h-4 w-4" />,
    label: "Viewer — read only. Aksi mutasi & export dinonaktifkan.",
  },
};

export function PersonaBanner({
  persona,
  scopeSummary,
}: {
  persona: Persona;
  scopeSummary: string;
}) {
  const tone = TONE[persona.role];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm",
        tone.className,
      )}
      role="status"
    >
      <span className="flex items-center gap-2 font-medium">
        {tone.icon}
        {persona.roleLabel}
      </span>
      <span className="opacity-80">{tone.label}</span>
      <span className="ml-auto text-[11px] font-medium opacity-80">Scope: {scopeSummary}</span>
    </div>
  );
}
