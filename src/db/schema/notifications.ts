import { boolean, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Notifications (Pusat Notifikasi & Reminder) — the per-recipient notification
 * inbox: reminders, deadline alerts, and system notices delivered to a persona,
 * each with a read flag and a link to the related page. Distinct from
 * reminder_logs (the dispatch record): this is the recipient-facing inbox that
 * powers the unread badge and the notification center. Keyed by recipient and,
 * optionally, the site the notification concerns.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Recipient persona/user identifier (e.g. persona id or user id). */
    recipient: varchar("recipient", { length: 128 }).notNull(),
    /** reminder | deadline | system. */
    source: varchar("source", { length: 24 }).notNull().default("system"),
    /** info | warning | danger. */
    level: varchar("level", { length: 16 }).notNull().default("info"),
    title: varchar("title", { length: 192 }).notNull(),
    detail: varchar("detail", { length: 512 }).notNull().default(""),
    /** Related page the notification links to. */
    href: varchar("href", { length: 256 }),
    projectCode: varchar("project_code", { length: 32 }),
    locationId: varchar("location_id", { length: 64 }),
    read: boolean("read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    recipientIdx: index("notifications_recipient_idx").on(t.recipient),
    unreadIdx: index("notifications_unread_idx").on(t.recipient, t.read),
    createdIdx: index("notifications_created_idx").on(t.createdAt),
  }),
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;
