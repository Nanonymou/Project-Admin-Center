import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * System parameters (Parameter Sistem) — global, application-level settings that
 * are distinct from per-project business config (tax, pricing, workflow). Each
 * row overrides a config-defined default (`system-parameters` mock) for one
 * parameter key. `value` is stored as text and coerced to the parameter's typed
 * shape (number/boolean/select/text) by the service layer, since a single column
 * holds heterogeneous types. Backs the `/parameter-sistem` UI.
 */
export const systemParameters = pgTable(
  "system_parameters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Matches a key in the config catalogue (e.g. `session_timeout_min`). */
    key: varchar("key", { length: 64 }).notNull(),
    /** Serialized value; interpreted per the config parameter's declared type. */
    value: text("value").notNull(),
    ...auditColumns,
  },
  (t) => ({
    keyIdx: uniqueIndex("system_parameters_key_idx").on(t.key),
  }),
);

/**
 * Immutable audit trail of parameter changes — every edit appends a row capturing
 * the before/after values and who changed them, so the Parameter Sistem page can
 * show a change history and support review. Never updated in place.
 */
export const systemParameterHistory = pgTable(
  "system_parameter_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 64 }).notNull(),
    beforeValue: text("before_value"),
    afterValue: text("after_value").notNull(),
    changedBy: varchar("changed_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    keyIdx: index("system_parameter_history_key_idx").on(t.key),
  }),
);

export type SystemParameterRow = typeof systemParameters.$inferSelect;
export type NewSystemParameterRow = typeof systemParameters.$inferInsert;
export type SystemParameterHistoryRow = typeof systemParameterHistory.$inferSelect;
export type NewSystemParameterHistoryRow = typeof systemParameterHistory.$inferInsert;
