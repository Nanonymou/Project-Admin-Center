"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, LogIn, Mail, Lock, ShieldCheck, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersona } from "@/components/providers/persona-provider";
import { SESSION_KEY } from "@/lib/auth";
import { DEMO_PASSWORD, PERSONAS, type PersonaRole } from "@/lib/personas";

/**
 * Login screen backed by NextAuth (Auth.js) credentials. Authentication is real
 * — `signIn("credentials")` validates the email + password against the persona
 * roster (see `src/auth.ts`) and issues a session cookie. The user data is still
 * dummy: any persona's email with the demo password signs in. Picking a persona
 * pre-fills its email so the demo stays one click away.
 */

/** Small colour accent per role so the persona picker reads at a glance. */
const ROLE_ACCENT: Record<PersonaRole, string> = {
  super_admin: "bg-violet-100 text-violet-700",
  leader_admin: "bg-sky-100 text-sky-700",
  site_admin: "bg-emerald-100 text-emerald-700",
  viewer: "bg-slate-100 text-slate-600",
};

export function LoginClient() {
  const router = useRouter();
  const { setPersonaId } = usePersona();

  const [personaId, setLocalPersonaId] = useState(PERSONAS[0].id);
  const selected = PERSONAS.find((p) => p.id === personaId) ?? PERSONAS[0];
  const [email, setEmail] = useState(PERSONAS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function pickPersona(id: string) {
    setLocalPersonaId(id);
    const p = PERSONAS.find((x) => x.id === id);
    if (p) setEmail(p.email);
    setError("");
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email dan kata sandi wajib diisi.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError("Email atau kata sandi salah.");
      return;
    }
    // Start the persona simulation on the account just signed in, and clear any
    // stale override so the provider adopts this identity.
    setPersonaId(personaId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_KEY, personaId);
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Masuk sebagai (demo)</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {PERSONAS.map((p) => {
                  const active = p.id === personaId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickPersona(p.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors ${
                        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${ROLE_ACCENT[p.role]}`}
                      >
                        {p.initials}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{p.roleLabel}</span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                Peran menentukan akses: {selected.roleLabel}.
              </p>
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <Button type="submit" className="w-full gap-1.5" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Memproses…" : "Masuk"}
            </Button>
          </form>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Login demo — kata sandi untuk semua akun: <span className="font-mono">{DEMO_PASSWORD}</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
