"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { usePersona } from "@/components/providers/persona-provider";
import { isPathAllowedForRole, landingForRole } from "@/lib/mock/access-config";

/**
 * Client-side role route guard. When the active persona lands on a path their
 * role may not open (per `access-config`), it redirects them to their role's
 * default landing and shows a brief notice instead of the forbidden content.
 * This is a UX guard layered on the config-driven menu — the backend RBAC
 * middleware (a later task) remains the real security boundary.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { persona } = usePersona();

  const allowed = isPathAllowedForRole(persona.role, pathname ?? "/");

  useEffect(() => {
    if (!allowed) {
      router.replace(landingForRole(persona.role));
    }
  }, [allowed, persona.role, router]);

  if (!allowed) {
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
