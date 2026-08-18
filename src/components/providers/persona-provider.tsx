"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { DEFAULT_PERSONA_ID, getPersonaById, PERSONAS, type Persona } from "@/lib/personas";
import { setGrantedLocations } from "@/lib/client/notif";
import { projectsForLocations } from "@/lib/site-access";

type PersonaContextValue = {
  persona: Persona;
  personas: Persona[];
};

const PersonaContext = createContext<PersonaContextValue | null>(null);

type LiveUser = { personaId: string; name: string; email: string; locations: string[] };

/** Initials from a display name, e.g. "Desy Carolina" → "DC". */
function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
}

/**
 * Active-persona context. The identity is the real signed-in account (NextAuth
 * session), enriched with its live database record so name/email/role changes a
 * Super Admin makes are reflected. The persona id maps to the role/scope/
 * capabilities template in `personas.ts`. There is no demo switching — you are
 * whoever you logged in as.
 */
export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [live, setLive] = useState<LiveUser | null>(null);

  // Pull the fresh DB identity; sign out if the account was deleted/deactivated.
  useEffect(() => {
    if (status !== "authenticated") {
      setLive(null);
      return;
    }
    let cancelled = false;
    fetch("/api/account/me", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          await signOut({ redirectTo: "/login" });
          return;
        }
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.user) {
          setLive({
            personaId: data.user.personaId,
            name: data.user.name,
            email: data.user.email,
            locations: Array.isArray(data.user.locations) ? data.user.locations : [],
          });
        }
      })
      .catch(() => {
        /* transient — keep the session values */
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email]);

  const persona = useMemo<Persona>(() => {
    const personaId = live?.personaId ?? session?.user?.personaId ?? DEFAULT_PERSONA_ID;
    const base = getPersonaById(personaId);
    const name = live?.name ?? session?.user?.name ?? base.name;
    const email = live?.email ?? session?.user?.email ?? base.email;

    // A Super Admin can grant this account an explicit set of sites; when present
    // it overrides the persona template's site scope (and its covered projects).
    const granted = live?.locations ?? [];
    const scope =
      granted.length > 0
        ? { projects: projectsForLocations(granted), locations: granted }
        : base.scope;

    return { ...base, name, email, initials: initialsOf(name), scope };
  }, [live, session?.user?.personaId, session?.user?.name, session?.user?.email]);

  // Mirror the resolved site grant into the header cache so persona-scoped API
  // calls carry it (server honours the same scope the client sees).
  useEffect(() => {
    setGrantedLocations(persona.scope.locations);
  }, [persona.scope.locations]);

  const value = useMemo<PersonaContextValue>(() => ({ persona, personas: PERSONAS }), [persona]);

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used inside <PersonaProvider>");
  return ctx;
}
