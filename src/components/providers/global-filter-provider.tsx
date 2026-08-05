"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_FILTER_STATE,
  type ActivityFilterState,
} from "@/lib/mock/filters";

type GlobalFilterContextValue = {
  filters: ActivityFilterState;
  setFilters: (next: ActivityFilterState) => void;
  reset: () => void;
};

const GlobalFilterContext = createContext<GlobalFilterContextValue | null>(null);

const STORAGE_KEY = "pac.global-filters";

export function GlobalFilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<ActivityFilterState>(DEFAULT_FILTER_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ActivityFilterState;
        setFiltersState({ ...DEFAULT_FILTER_STATE, ...parsed });
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const setFilters = useCallback((next: ActivityFilterState) => {
    setFiltersState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const reset = useCallback(() => setFilters({ ...DEFAULT_FILTER_STATE }), [setFilters]);

  const value = useMemo(
    () => ({ filters, setFilters, reset }),
    [filters, setFilters, reset],
  );

  // Avoid a hydration mismatch flash — render once localStorage is checked.
  if (!hydrated) return <>{children}</>;

  return <GlobalFilterContext.Provider value={value}>{children}</GlobalFilterContext.Provider>;
}

export function useGlobalFilters(): GlobalFilterContextValue {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) {
    // Fallback: allow use outside provider (renders default, no persistence).
    return {
      filters: DEFAULT_FILTER_STATE,
      setFilters: () => undefined,
      reset: () => undefined,
    };
  }
  return ctx;
}
