"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, LogIn, Mail, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Login screen — real, database-backed credentials via NextAuth. Only accounts
 * that exist in the database (managed by a Super Admin) can sign in.
 */
export function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email: email.trim(), password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError("Email atau kata sandi salah.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Project Admin Center</CardTitle>
          <CardDescription>Masuk untuk mengakses workspace Anda.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@perusahaan.co.id"
                  className="h-9 pl-8"
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Kata Sandi</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-9 pl-8"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <Button type="submit" className="w-full gap-1.5" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Memproses…" : "Masuk"}
            </Button>
          </form>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Akun dikelola oleh Super Admin. Hubungi admin bila lupa kata sandi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
