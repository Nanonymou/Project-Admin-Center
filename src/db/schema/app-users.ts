import { boolean, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Login accounts (real authentication). Each row is a user who can sign in:
 * email + a bcrypt `password_hash`, plus the `persona_id` that determines their
 * role, scope, and capabilities (mapped to `src/lib/personas.ts`).
 *
 * Managed by Super Admin via the Kelola Akun Login screen. Distinct from the
 * config-driven `users` (Hak Akses) directory — this table is strictly the
 * authentication source for NextAuth.
 */
export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 160 }).notNull(),
    /** bcrypt hash — never store or return the plaintext password. */
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    /** Maps to a persona id (role + scope + capabilities). */
    personaId: varchar("persona_id", { length: 48 }).notNull(),
    /**
     * Comma-separated locationIds this account may access, granted by a Super
     * Admin (e.g. "loc-km22,loc-santan"). Empty = use the persona's default
     * scope. When set, it overrides the persona's site scope for this account.
     */
    locations: varchar("locations", { length: 512 }).default("").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex("app_users_email_idx").on(t.email),
  }),
);

export type AppUserRow = typeof appUsers.$inferSelect;
export type NewAppUserRow = typeof appUsers.$inferInsert;
