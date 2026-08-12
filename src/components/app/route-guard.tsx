"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShieldAlert } from "lucide-react";
import { usePersona } from "@/components/providers/persona-provider";
import { isPathAllowedForRole, landingForRole } from "@/lib/mock/access-config";

/**
 * Route guard — two layers:
 *  1. **Authentication** (NextAuth): an unauthenticated visitor is redirected to
 *     `/login`. This is the real access boundary now that Auth.js is wired.
 *  2. **Role authorization**: an authenticated persona that lands on a path its
 *     role may not open (per `access-config`) is redirected to its role's
 *     default landing.
 *
 * The `/login` route is exempt from both so the sign-in screen renders freely.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const { persona } = usePersona();

  const isLoginRoute = pathname === "/login";
  const authenticated = status === "authenticated";
  const roleAllowed = isPathAllowedForRole(persona.role, pathname ?? "/");

  useEffect(() => {
    if (isLoginRoute) return;
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && !roleAllowed) {
      router.replace(landingForRole(persona.role));
    }
  }, [isLoginRoute, status, roleAllowed, persona.role, router]);

  // The login screen always renders its own content.
  if (isLoginRoute) return <>{children}</>;

  // While the session resolves, or during a redirect, show a light placeholder
  // instead of flashing protected content.
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-sm text-muted-foreground">
        Memuat…
      </div>
    );
  }

  if (!roleAllowed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 p-6 text-center">
        <ShieldAlert className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-medium">Halaman ini di luar hak akses peran Anda.</p>
        <p className="text-xs text-muted-foreground">Mengalihkan ke halaman utama…</p>
      </div>
    );
  }

  return <>{children}</>;
}
