import { auth } from "@/auth";

export type SuperAdminSession = { userId: string; email: string; personaId: string };

/**
 * Resolve the caller's NextAuth session and require the Super Admin role. Returns
 * the session user when allowed, or null — callers return 401/403 on null. This
 * is the real authorization boundary for account management (not the persona
 * header), since these routes act on login credentials.
 */
export async function requireSuperAdmin(): Promise<SuperAdminSession | null> {
  const session = await auth();
  const user = session?.user;
  if (!user || user.role !== "super_admin") return null;
  return { userId: user.personaId ?? "", email: user.email ?? "", personaId: user.personaId ?? "" };
}
