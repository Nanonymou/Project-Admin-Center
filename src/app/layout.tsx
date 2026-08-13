import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app/app-shell";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { PersonaProvider } from "@/components/providers/persona-provider";
import { GlobalFilterProvider } from "@/components/providers/global-filter-provider";
import { ActiveSiteProvider } from "@/components/providers/active-site-provider";

export const metadata: Metadata = {
  title: "Project Admin Center",
  description: "Enterprise Project Administration ERP untuk catering pertambangan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AuthSessionProvider>
          <PersonaProvider>
            <ActiveSiteProvider>
              <GlobalFilterProvider>
                <AppShell>{children}</AppShell>
              </GlobalFilterProvider>
            </ActiveSiteProvider>
          </PersonaProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
