"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_PERSONA_ID, getPersonaById, PERSONAS, type Persona } from "@/lib/personas";

type PersonaContextValue = {
  persona: Persona;
  personas: Persona[];
  setPersonaId: (id: string) => void;
};

const PersonaContext = createContext<PersonaContextValue | null>(null);

const STORAGE_KEY = "pac.persona";

/**
 * Active-persona context. The persona is the identity the UI acts as.
 *
 * Identity comes from the NextAuth session (`session.user.personaId`) once the
 * user has signed in. The topbar "simulasikan sebagai" switcher may override it
 * locally (persisted in localStorage) to preview other roles without changing
 * the real login — so a stored value always wins over the session value.
 */
export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [personaId, setPersonaIdState] = useState<string>(DEFAULT_PERSONA_ID);

  // Adopt a stored simulation override, or fall back to the signed-in persona.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setPersonaIdState(stored);
      return;
    }
    const sessionPersonaId = session?.user?.personaId;
    if (sessionPersonaId) setPersonaIdState(sessionPersonaId);
  }, [session?.user?.personaId]);

  const setPersonaId = useCallback((id: string) => {
    setPersonaIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const value = useMemo<PersonaContextValue>(
    () => ({ persona: getPersonaById(personaId), personas: PERSONAS, setPersonaId }),
    [personaId, setPersonaId],
  );

  return <PersonaContext.Provider value={value}>{children}</PersonaContext.Provider>;
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used inside <PersonaProvider>");
  return ctx;
}
