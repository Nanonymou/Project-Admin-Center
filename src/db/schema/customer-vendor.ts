import { boolean, index, pgTable, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { auditColumns } from "./columns";

/**
 * Master Customer & Vendor (Master Customer & Vendor feature) — org-level party
 * records (not per-site). Customers are the mining/energy clients served; vendors
 * are the suppliers behind catering & support services. A single table with a
 * `type` discriminator backs both, since they share the same contact/tax shape.
 * Backs the `/master-customer-vendor` UI's `customer-vendor` config.
 */
export const customerVendors = pgTable(
  "customer_vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Unique business code, e.g. `CUST-BUMA` / `VND-PANGAN`. */
    code: varchar("code", { length: 48 }).notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    /** customer | vendor. */
    type: varchar("type", { length: 16 }).notNull(),
    /** Refinement, e.g. "Tambang Batubara" / "Supplier Bahan Pangan". */
    category: varchar("category", { length: 96 }).notNull().default(""),
    contactPerson: varchar("contact_person", { length: 128 }).notNull().default(""),
    phone: varchar("phone", { length: 48 }).notNull().default(""),
    email: varchar("email", { length: 160 }).notNull().default(""),
    city: varchar("city", { length: 96 }).notNull().default(""),
    /** Indonesian tax id (NPWP). */
    npwp: varchar("npwp", { length: 32 }).notNull().default(""),
    address: varchar("address", { length: 256 }).notNull().default(""),
    active: boolean("active").default(true).notNull(),
    ...auditColumns,
  },
  (t) => ({
    codeIdx: uniqueIndex("customer_vendors_code_idx").on(t.code),
    typeIdx: index("customer_vendors_type_idx").on(t.type),
  }),
);

export type CustomerVendorRow = typeof customerVendors.$inferSelect;
export type NewCustomerVendorRow = typeof customerVendors.$inferInsert;
