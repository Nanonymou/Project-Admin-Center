import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { notifications, type NotificationRow, type NewNotificationRow } from "@/db/schema";

/**
 * Notification inbox data access (Pusat Notifikasi & Reminder). Repository
 * Pattern: all DB access to the notifications table flows through this module.
 */

export type NotificationListFilter = { recipient: string; unreadOnly?: boolean; limit?: number };

/** List a recipient's notifications, newest first. */
export async function listNotifications(filter: NotificationListFilter): Promise<NotificationRow[]> {
  const conds: SQL[] = [eq(notifications.recipient, filter.recipient)];
  if (filter.unreadOnly) conds.push(eq(notifications.read, false));
  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conds))
    .orderBy(desc(notifications.createdAt));
  return filter.limit && filter.limit > 0 ? rows.slice(0, filter.limit) : rows;
}

/** Fetch a single notification by id, or undefined. */
export async function getNotificationById(id: string): Promise<NotificationRow | undefined> {
  const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  return row;
}

export async function insertNotifications(entries: NewNotificationRow[]): Promise<number> {
  if (entries.length === 0) return 0;
  await db.insert(notifications).values(entries);
  return entries.length;
}

/** Mark a notification read/unread. Returns false when not found. */
export async function setNotificationRead(id: string, read: boolean): Promise<boolean> {
  const existing = await getNotificationById(id);
  if (!existing) return false;
  await db
    .update(notifications)
    .set({ read, readAt: read ? new Date() : null })
    .where(eq(notifications.id, id));
  return true;
}

/** Mark all of a recipient's notifications read. Returns the count updated. */
export async function markAllRead(recipient: string): Promise<number> {
  const rows = await listNotifications({ recipient, unreadOnly: true });
  if (rows.length === 0) return 0;
  await db
    .update(notifications)
    .set({ read: true, readAt: new Date() })
    .where(and(eq(notifications.recipient, recipient), eq(notifications.read, false)));
  return rows.length;
}
