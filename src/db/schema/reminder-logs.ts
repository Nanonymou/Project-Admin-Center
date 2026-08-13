import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Reminder log (Reminder Cut-Off Otomatis) — a record of every reminder actually
 * dispatched: which cut-off/deadline trigger fired, the channel it went out on,
 * the audience, and its delivery status (sent → acknowledged / escalated). Backs
 * the "Riwayat Reminder" view. Append-only; keyed generically by project_code/
 * location_id so one table serves every site.
 */
export const reminderLogs = pgTable(
  "reminder_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** info | warning | critical. */
    level: varchar("level", { length: 16 }).notNull().default("info"),
    /** h_minus_7 | h_minus_3 | h_minus_1 | overdue | closing. */
    trigger: varchar("trigger", { length: 24 }).notNull(),
    title: varchar("title", { length: 192 }).notNull(),
    /** email | in-app | whatsapp. */
    channel: varchar("channel", { length: 16 }).notNull().default("in-app"),
    /** sent | acknowledged | escalated. */
    status: varchar("status", { length: 16 }).notNull().default("sent"),
    /** Leader | Site | Finance. */
    audience: varchar("audience", { length: 16 }).notNull().default("Site"),
    projectCode: varchar("project_code", { length: 32 }),
    locationId: varchar("location_id", { length: 64 }),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    siteIdx: index("reminder_logs_site_idx").on(t.projectCode, t.locationId),
    sentIdx: index("reminder_logs_sent_idx").on(t.sentAt),
  }),
);

export type ReminderLogRow = typeof reminderLogs.$inferSelect;
export type NewReminderLogRow = typeof reminderLogs.$inferInsert;
