import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { customerVendors, type CustomerVendorRow, type NewCustomerVendorRow } from "@/db/schema";

/**
 * Master Customer & Vendor data access. Repository Pattern: all DB access to
 * customer_vendors flows through this module.
 */

export type PartyListFilter = { type?: "customer" | "vendor"; activeOnly?: boolean };

export async function listCustomerVendors(filter: PartyListFilter = {}): Promise<CustomerVendorRow[]> {
  const rows = await db.select().from(customerVendors).orderBy(asc(customerVendors.code));
  return rows.filter(
    (r) => (!filter.type || r.type === filter.type) && (!filter.activeOnly || r.active),
  );
}

export async function getCustomerVendorByCode(code: string): Promise<CustomerVendorRow | undefined> {
  const [row] = await db.select().from(customerVendors).where(eq(customerVendors.code, code)).limit(1);
  return row;
}

/** Upsert a party by its unique code. */
export async function upsertCustomerVendor(values: NewCustomerVendorRow): Promise<void> {
  await db
    .insert(customerVendors)
    .values(values)
    .onConflictDoUpdate({
      target: customerVendors.code,
      set: {
        name: values.name,
        type: values.type,
        category: values.category,
        contactPerson: values.contactPerson,
        phone: values.phone,
        email: values.email,
        city: values.city,
        npwp: values.npwp,
        address: values.address,
        active: values.active ?? true,
        updatedAt: new Date(),
      },
    });
}

/** Activate/deactivate a party by code. */
export async function setCustomerVendorActive(code: string, active: boolean): Promise<boolean> {
  const existing = await getCustomerVendorByCode(code);
  if (!existing) return false;
  await db.update(customerVendors).set({ active, updatedAt: new Date() }).where(eq(customerVendors.code, code));
  return true;
}
