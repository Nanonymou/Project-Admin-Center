"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogIn, Mail, Lock, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersona } from "@/components/providers/persona-provider";
import { SESSION_KEY } from "@/lib/auth";
import { PERSONAS } from "@/lib/personas";

/**
 * Mock login screen (frontend-first). Authentication is simulated: pick the
 * persona to sign in as, then "Masuk" records a session flag in localStorage and
 * routes to the dashboard. There is no real credential check — the backend
 * auth/session API is a later task; this establishes the login/logout UX and the
 * session flag the shell reads.
 */
export function LoginClient() {
  const router = useRouter();
  const { setPersonaId } = usePersona();

  const [personaId, setLocalPersonaId] = useState(PERSONAS[0].id);
  const selected = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }
    setPersonaId(personaId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, personaId);
    }
    router.push("/dashboard");
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
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@tpb.co.id"
                  className="h-9 pl-8"
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
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Masuk sebagai (demo)</label>
              <select
                value={personaId}
                onChange={(e) => setLocalPersonaId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.roleLabel}
                  </option>
                ))}
              </select>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                Peran menentukan akses: {selected.roleLabel}.
              </p>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <Button type="submit" className="w-full gap-1.5">
              <LogIn className="h-4 w-4" />
              Masuk
            </Button>
          </form>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Login demo — autentikasi backend menyusul. Kredensial tidak divalidasi.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
