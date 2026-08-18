import { PERSONAS, canAccessLocation } from "@/lib/personas";
import { insertNotifications } from "@/db/repositories/notification-repository";
import type { NewNotificationRow } from "@/db/schema";

/**
 * Fan a real-event notification out to every persona who can see the affected
 * site (recipients are keyed by persona id, mirroring the notification
 * generator). Best-effort: never throws, so it can be awaited from a mutation
 * route without risking the main action. Returns the number of rows written.
 *
 * When no site is given (locationId/projectCode omitted) the notification goes
 * to every persona — used for portfolio-wide events.
 */
export async function notifySiteEvent(input: {
  projectCode?: string | null;
  locationId?: string | null;
  title: string;
  detail?: string;
  href?: string | null;
  level?: "info" | "warning" | "success" | "danger";
  source?: string;
  /** Persona name to exclude (e.g. the actor) so they aren't notified of their own action. */
  excludeActor?: string;
}): Promise<number> {
  const { projectCode, locationId } = input;
  const recipients = PERSONAS.filter((p) => {
    if (input.excludeActor && p.name === input.excludeActor) return false;
    if (locationId && projectCode) return canAccessLocation(p, locationId, projectCode);
    return true;
  });
  if (recipients.length === 0) return 0;

  const rows: NewNotificationRow[] = recipients.map((p) => ({
    recipient: p.id,
    source: input.source ?? "system",
    level: input.level ?? "info",
    title: input.title,
    detail: input.detail ?? "",
    href: input.href ?? null,
    projectCode: projectCode ?? null,
    locationId: locationId ?? null,
  }));

  try {
    return await insertNotifications(rows);
  } catch {
    return 0;
  }
}
