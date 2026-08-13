import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DEMO_PASSWORD, getPersonaByEmail, type PersonaRole } from "@/lib/personas";

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
      authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const persona = getPersonaByEmail(email);
        if (!persona || password !== DEMO_PASSWORD) return null;
        return {
          id: persona.id,
          name: persona.name,
          email: persona.email,
          personaId: persona.id,
          role: persona.role,
        };
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
