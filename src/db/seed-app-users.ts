import bcrypt from "bcryptjs";
import { db } from "@/db";
import { appUsers } from "@/db/schema/app-users";
import { DEMO_PASSWORD, PERSONAS } from "@/lib/personas";

export type AppUserSeedResult = { accounts: number };

/**
 * Seed one login account per persona so the app has real sign-in credentials out
 * of the box. Passwords are the shared `DEMO_PASSWORD`, bcrypt-hashed. Idempotent:
 * existing emails are left untouched (so a changed password/role is not reset).
 */
export async function seedAppUsers(): Promise<AppUserSeedResult> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const rows = PERSONAS.map((p) => ({
    email: p.email.toLowerCase(),
    name: p.name,
    personaId: p.id,
    passwordHash,
    isActive: true,
  }));
  await db.insert(appUsers).values(rows).onConflictDoNothing({ target: appUsers.email });
  return { accounts: rows.length };
}
