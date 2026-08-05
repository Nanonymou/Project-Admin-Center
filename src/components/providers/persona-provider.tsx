"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_PERSONA_ID, getPersonaById, PERSONAS, type Persona } from "@/lib/personas";

type PersonaContextValue = {
  persona: Persona;
  personas: Persona[];
  setPersonaId: (id: string) => void;
};

const PersonaContext = createContext<PersonaContextValue | null>(null);

const STORAGE_KEY = "pac.persona";

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [personaId, setPersonaIdState] = useState<string>(DEFAULT_PERSONA_ID);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setPersonaIdState(stored);
  }, []);

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
