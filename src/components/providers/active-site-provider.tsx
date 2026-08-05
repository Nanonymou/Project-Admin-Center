"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MOCK_WORKSPACES, type Workspace } from "@/lib/mock/workspaces";

type ActiveSiteContextValue = {
  activeLocationId: string;
  setActiveLocationId: (id: string) => void;
  activeWorkspace: Workspace;
  workspaces: Workspace[];
};

const ActiveSiteContext = createContext<ActiveSiteContextValue | null>(null);

const STORAGE_KEY = "pac.active-site";

export function ActiveSiteProvider({ children }: { children: React.ReactNode }) {
  const [activeLocationId, setActiveLocationIdState] = useState<string>(
    MOCK_WORKSPACES[0]?.locationId ?? "",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && MOCK_WORKSPACES.some((w) => w.locationId === stored)) {
      setActiveLocationIdState(stored);
    }
  }, []);

  const setActiveLocationId = useCallback((id: string) => {
    setActiveLocationIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const value = useMemo<ActiveSiteContextValue>(() => {
    const activeWorkspace =
      MOCK_WORKSPACES.find((w) => w.locationId === activeLocationId) ?? MOCK_WORKSPACES[0];
    return {
      activeLocationId,
      setActiveLocationId,
      activeWorkspace,
      workspaces: MOCK_WORKSPACES,
    };
  }, [activeLocationId, setActiveLocationId]);

  return <ActiveSiteContext.Provider value={value}>{children}</ActiveSiteContext.Provider>;
}

export function useActiveSite() {
  const ctx = useContext(ActiveSiteContext);
  if (!ctx) throw new Error("useActiveSite must be used inside <ActiveSiteProvider>");
  return ctx;
}
