import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tenancyColumns } from "./columns";
import { dailyClosings } from "./daily-closings";

/** Action recorded on the daily-closing history log. */
export const dailyClosingAction = pgEnum("daily_closing_action", [
  "open",
  "submit",
  "approve",
  "reject",
  "lock",
  "reopen",
]);

/**
 * Append-only daily-closing history — one row per action taken on a day's closing
 * (submitted, approved, locked, reopened), preserving who moved it and when.
 * Tenant-scoped by project_id/location_id and linked to the closing by FK.
 */
export const dailyClosingHistory = pgTable(
  "daily_closing_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    closingId: uuid("closing_id")
      .notNull()
      .references(() => dailyClosings.id, { onDelete: "cascade" }),
    ...tenancyColumns,
    action: dailyClosingAction("action").notNull(),
    fromStatus: varchar("from_status", { length: 32 }),
    toStatus: varchar("to_status", { length: 32 }),
    actor: varchar("actor", { length: 128 }).notNull(),
    note: varchar("note", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    closingIdx: index("daily_closing_history_closing_idx").on(t.closingId),
    tenantIdx: index("daily_closing_history_tenant_idx").on(t.projectId, t.locationId),
    createdIdx: index("daily_closing_history_created_idx").on(t.createdAt),
  }),
);

export const dailyClosingHistoryRelations = relations(dailyClosingHistory, ({ one }) => ({
  closing: one(dailyClosings, {
    fields: [dailyClosingHistory.closingId],
    references: [dailyClosings.id],
  }),
}));

export type DailyClosingHistoryEntry = typeof dailyClosingHistory.$inferSelect;
export type NewDailyClosingHistoryEntry = typeof dailyClosingHistory.$inferInsert;
