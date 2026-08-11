import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  userSiteAccess,
  type UserRow,
  type UserSiteAccessRow,
} from "@/db/schema";

/**
 * User + site-access data access (Hak Akses feature). Repository Pattern: all DB
 * access to users / user_site_access flows through this module. A user's site
 * grants are managed atomically alongside the account so the mapping never drifts.
 */

export type SiteGrantInput = {
  projectCode: string;
  /** Null = all locations under the project; otherwise a single location. */
  locationId: string | null;
};

export type UserWithAccess = UserRow & { siteAccess: UserSiteAccessRow[] };

/** List all users with their site grants, by name. */
export async function listUsers(): Promise<UserWithAccess[]> {
  const rows = await db.select().from(users).orderBy(asc(users.name));
  const out: UserWithAccess[] = [];
  for (const u of rows) {
    const grants = await db.select().from(userSiteAccess).where(eq(userSiteAccess.userId, u.id));
    out.push({ ...u, siteAccess: grants });
  }
  return out;
}

/** Fetch a single user with their site grants, or undefined. */
export async function getUser(id: string): Promise<UserWithAccess | undefined> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) return undefined;
  const grants = await db.select().from(userSiteAccess).where(eq(userSiteAccess.userId, u.id));
  return { ...u, siteAccess: grants };
}

export type CreateUserInput = {
  name: string;
  email: string;
  role: string;
  status?: string;
  siteAccess: SiteGrantInput[];
  createdBy?: string;
};

/**
 * Create a user and its site grants atomically. Returns the new user id. The
 * caller is responsible for validating the role (active + known) beforehand.
 */
export async function createUser(input: CreateUserInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        role: input.role,
        status: input.status ?? "invited",
        createdBy: input.createdBy,
      })
      .returning({ id: users.id });

    if (input.siteAccess.length > 0) {
      await tx.insert(userSiteAccess).values(
        input.siteAccess.map((g) => ({
          userId: row.id,
          projectCode: g.projectCode,
          locationId: g.locationId,
          createdBy: input.createdBy,
        })),
      );
    }
    return row.id;
  });
}

export type UpdateUserInput = {
  id: string;
  name?: string;
  role?: string;
  status?: string;
  /** When provided, the site grants are fully replaced with this set. */
  siteAccess?: SiteGrantInput[];
  updatedBy?: string;
};

/**
 * Update a user's fields and (optionally) replace its site grants atomically.
 * Returns false when the user does not exist.
 */
export async function updateUser(input: UpdateUserInput): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.id)).limit(1);
    if (!existing) return false;

    const set: Partial<UserRow> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    if (input.role !== undefined) set.role = input.role;
    if (input.status !== undefined) set.status = input.status;
    await tx.update(users).set(set).where(eq(users.id, input.id));

    if (input.siteAccess) {
      await tx.delete(userSiteAccess).where(eq(userSiteAccess.userId, input.id));
      if (input.siteAccess.length > 0) {
        await tx.insert(userSiteAccess).values(
          input.siteAccess.map((g) => ({
            userId: input.id,
            projectCode: g.projectCode,
            locationId: g.locationId,
            createdBy: input.updatedBy,
          })),
        );
      }
    }
    return true;
  });
}

/** Change a user's status (active | invited | suspended). Returns false if absent. */
export async function setUserStatus(id: string, status: string): Promise<boolean> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return false;
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, id));
  return true;
}
