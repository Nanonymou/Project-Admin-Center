import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { PersonaProvider } from "@/components/providers/persona-provider";

export const metadata: Metadata = {
  title: "Project Admin Center",
  description: "Enterprise Project Administration ERP untuk catering pertambangan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <PersonaProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1">{children}</main>
            </div>
          </div>
        </PersonaProvider>
      </body>
    </html>
  );
}
