"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { RouteGuard } from "@/components/app/route-guard";

/**
 * App chrome. On `/login` the sign-in screen is shown full-bleed (no sidebar or
 * topbar); every other route renders inside the sidebar + topbar shell with the
 * `RouteGuard` enforcing authentication and role access.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <RouteGuard>{children}</RouteGuard>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1">
          <RouteGuard>{children}</RouteGuard>
        </main>
      </div>
    </div>
  );
}
