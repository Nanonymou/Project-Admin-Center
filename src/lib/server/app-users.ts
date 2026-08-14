import "server-only";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, type AppUserRow } from "@/db/schema/app-users";
import { getPersonaById } from "@/lib/personas";

/** A login account, without the password hash — safe to send to the client. */
export type AppUserPublic = {
  id: string;
  email: string;
  name: string;
  personaId: string;
  roleLabel: string;
  role: string;
  isActive: boolean;
};

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function toPublic(row: AppUserRow): AppUserPublic {
  const persona = getPersonaById(row.personaId);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    personaId: row.personaId,
    roleLabel: persona.roleLabel,
    role: persona.role,
    isActive: row.isActive,
  };
}

export async function getAppUserByEmail(email: string): Promise<AppUserRow | undefined> {
  const rows = await db.select().from(appUsers).where(eq(appUsers.email, email.trim().toLowerCase())).limit(1);
  return rows[0];
}

export async function listAppUsers(): Promise<AppUserPublic[]> {
  const rows = await db.select().from(appUsers).orderBy(appUsers.createdAt);
  return rows.map(toPublic);
}

export async function countActiveSuperAdmins(excludeId?: string): Promise<number> {
  const rows = await db.select().from(appUsers).where(eq(appUsers.isActive, true));
  return rows.filter((r) => r.personaId === "persona-super" && r.id !== excludeId).length;
}

export async function emailExists(email: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(excludeId ? and(eq(appUsers.email, email), ne(appUsers.id, excludeId)) : eq(appUsers.email, email));
  return rows.length > 0;
}

export async function createAppUser(input: {
  email: string;
  name: string;
  personaId: string;
  password: string;
  isActive?: boolean;
}): Promise<AppUserPublic> {
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(appUsers)
    .values({
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      personaId: input.personaId,
      passwordHash,
      isActive: input.isActive ?? true,
    })
    .returning();
  return toPublic(row);
}

export async function updateAppUser(
  id: string,
  patch: { email?: string; name?: string; personaId?: string; isActive?: boolean },
): Promise<AppUserPublic | undefined> {
  const values: Partial<typeof appUsers.$inferInsert> = { updatedAt: new Date() };
  if (patch.email !== undefined) values.email = patch.email.trim().toLowerCase();
  if (patch.name !== undefined) values.name = patch.name.trim();
  if (patch.personaId !== undefined) values.personaId = patch.personaId;
  if (patch.isActive !== undefined) values.isActive = patch.isActive;
  const [row] = await db.update(appUsers).set(values).where(eq(appUsers.id, id)).returning();
  return row ? toPublic(row) : undefined;
}

export async function setAppUserPassword(id: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  const [row] = await db
    .update(appUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(appUsers.id, id))
    .returning({ id: appUsers.id });
  return Boolean(row);
}

export async function deleteAppUser(id: string): Promise<boolean> {
  const [row] = await db.delete(appUsers).where(eq(appUsers.id, id)).returning({ id: appUsers.id });
  return Boolean(row);
}
