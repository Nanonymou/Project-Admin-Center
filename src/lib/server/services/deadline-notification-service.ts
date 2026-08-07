export type DeadlineNotificationInput = {
  id: string;
  kind: string;
  title: string;
  projectCode: string;
  locationId: string;
  locationName?: string;
  owner?: string;
  dueDate: string; // YYYY-MM-DD
  status: string;
};

export type NotificationSeverity = "critical" | "warning" | "info";

export type DeadlineNotification = DeadlineNotificationInput & {
  daysRelative: number;
  severity: NotificationSeverity;
  message: string;
};

/** Only these statuses warrant a notification; the rest are silent. */
const ACTIONABLE = new Set(["due_soon", "due_today", "overdue"]);

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function severityOf(status: string, days: number): NotificationSeverity {
  if (status === "overdue" || status === "due_today" || days <= 0) return "critical";
  if (status === "due_soon" || days <= 3) return "warning";
  return "info";
}

function dueLabel(days: number): string {
  if (days === 0) return "jatuh tempo hari ini";
  if (days > 0) return `${days} hari lagi`;
  return `terlambat ${Math.abs(days)} hari`;
}

/**
 * Turn deadline entries into actionable notifications — dropping on-track and
 * settled items — each carrying a computed severity and a human-readable
 * message. Sorted most urgent first (soonest/most overdue on top). The
 * `daysRelative` is computed from `dueDate` so DB and mock inputs converge on
 * the same ordering regardless of any stored value.
 */
export function toDeadlineNotifications(
  items: DeadlineNotificationInput[],
  ref = new Date(),
): DeadlineNotification[] {
  const today = ref.toISOString().slice(0, 10);
  return items
    .filter((i) => ACTIONABLE.has(i.status))
    .map((i) => {
      const daysRelative = daysBetween(today, i.dueDate);
      return {
        ...i,
        daysRelative,
        severity: severityOf(i.status, daysRelative),
        message: `${i.title} — ${dueLabel(daysRelative)}`,
      };
    })
    .sort((a, b) => a.daysRelative - b.daysRelative);
}

export type NotificationSummary = {
  total: number;
  critical: number;
  warning: number;
  info: number;
};

export function summarizeNotifications(list: DeadlineNotification[]): NotificationSummary {
  return {
    total: list.length,
    critical: list.filter((n) => n.severity === "critical").length,
    warning: list.filter((n) => n.severity === "warning").length,
    info: list.filter((n) => n.severity === "info").length,
  };
}
