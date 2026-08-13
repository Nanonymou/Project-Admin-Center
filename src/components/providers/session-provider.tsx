"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Client wrapper around NextAuth's SessionProvider so the server `RootLayout`
 * can mount it. Makes `useSession()` available across the app.
 */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
