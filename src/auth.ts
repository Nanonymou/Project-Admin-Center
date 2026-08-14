import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DEMO_PASSWORD, getPersonaByEmail, getPersonaById, type PersonaRole } from "@/lib/personas";
import { getAppUserByEmail, verifyPassword } from "@/lib/server/app-users";

/**
 * NextAuth (Auth.js v5) configuration — real authentication over the dummy
 * persona roster.
 *
 * Frontend-first: there is no user database yet, so the Credentials provider
 * authenticates against the in-memory personas (`src/lib/personas.ts`) using a
 * shared demo password (`DEMO_PASSWORD`). Swapping in real per-user hashed
 * passwords later means only rewriting `authorize()` — the session shape and the
 * rest of the app stay the same.
 *
 * The signed-in persona id + role are carried in the JWT/session so the UI and
 * API can resolve who is acting without a database round-trip.
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
      name: "Demo",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata Sandi", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        // Primary: validate against the DB login accounts (per-user hashed password).
        try {
          const user = await getAppUserByEmail(email);
          if (user) {
            if (!user.isActive) return null;
            const ok = await verifyPassword(password, user.passwordHash);
            if (!ok) return null;
            const persona = getPersonaById(user.personaId);
            return { id: user.id, name: user.name, email: user.email, personaId: persona.id, role: persona.role };
          }
          // No such account in the DB → fall through to the demo fallback below.
        } catch {
          // DB unreachable (frontend-first / DB down) → fall through to demo login
          // so the app is never locked out.
        }

        // Fallback: the built-in persona roster + shared demo password.
        const persona = getPersonaByEmail(email);
        if (persona && password === DEMO_PASSWORD) {
          return { id: persona.id, name: persona.name, email: persona.email, personaId: persona.id, role: persona.role };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, persist persona id + role onto the token.
      if (user) {
        token.personaId = (user as { personaId?: string }).personaId ?? user.id;
        token.role = (user as { role?: PersonaRole }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.personaId = (token.personaId as string) ?? "";
        session.user.role = token.role as PersonaRole | undefined;
      }
      return session;
    },
  },
});
