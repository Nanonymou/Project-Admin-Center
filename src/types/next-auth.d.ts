import type { DefaultSession } from "next-auth";
import type { PersonaRole } from "@/lib/personas";

/**
 * Augment the NextAuth session/JWT with the persona id + role we attach in the
 * auth callbacks (see `src/auth.ts`).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      personaId: string;
      role?: PersonaRole;
    } & DefaultSession["user"];
  }

  interface User {
    personaId?: string;
    role?: PersonaRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    personaId?: string;
    role?: PersonaRole;
  }
}
