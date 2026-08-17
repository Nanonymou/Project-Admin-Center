import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getPersonaById, type PersonaRole } from "@/lib/personas";
import { getAppUserByEmail, verifyPassword } from "@/lib/server/app-users";

/**
 * NextAuth (Auth.js v5) configuration — real, database-backed authentication.
 *
 * The Credentials provider validates the email + password against the
 * `app_users` table (per-user bcrypt hash). Accounts are created and managed by
 * a Super Admin via Kelola Akun Login. There is no demo/shared-password login:
 * only real accounts in the database can sign in.
 *
 * The signed-in account's DB id, persona id, and role are carried in the
 * JWT/session so the UI and API can resolve who is acting. The persona id maps to
 * the role/scope/capabilities template in `src/lib/personas.ts`.
 *
 * Env: set `AUTH_SECRET` in production (Vercel). In dev, Auth.js derives a
 * throwaway secret automatically.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [
    Credentials({
      name: "Akun",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata Sandi", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await getAppUserByEmail(email);
        if (!user || !user.isActive) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        const persona = getPersonaById(user.personaId);
        return { id: user.id, name: user.name, email: user.email, personaId: persona.id, role: persona.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, persist the DB user id + persona id + role onto the token.
      if (user) {
        token.uid = user.id;
        token.personaId = (user as { personaId?: string }).personaId ?? user.id;
        token.role = (user as { role?: PersonaRole }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? "";
        session.user.personaId = (token.personaId as string) ?? "";
        session.user.role = token.role as PersonaRole | undefined;
      }
      return session;
    },
  },
});
