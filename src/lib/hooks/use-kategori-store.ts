"use client";

import { useCallback, useMemo, useState } from "react";
import { getServiceCategories } from "@/lib/mock/service-config";
import { getPriceFor } from "@/lib/mock/pricing-config";

export type KategoriRow = {
  key: string;
  label: string;
  unit: string;
  price: number;
  deduction: boolean;
  active: boolean;
  custom?: boolean;
  /** True when a base (config) category has session-local field edits. */
  edited?: boolean;
};

/** Field overrides applied on top of a base/custom category, keyed by category key. */
export type KategoriOverride = Partial<Pick<KategoriRow, "label" | "unit" | "price" | "deduction">>;

export type KategoriInput = { label: string; unit: string; price: number; deduction: boolean };

/**
 * Session-local mock store for Kategori Sales. Categories are per-project, so
 * every piece of state is keyed by project code: field overrides on config
 * categories, custom-added categories, and the deactivated key set. Nothing is
 * persisted — this is the frontend-first store the UI drives until the backend
 * category API lands.
 */
export function useKategoriStore(projectCode: string, locationId: string) {
  const [overrides, setOverrides] = useState<Record<string, Record<string, KategoriOverride>>>({});
  const [customCats, setCustomCats] = useState<Record<string, KategoriRow[]>>({});
  const [inactive, setInactive] = useState<Record<string, string[]>>({});

  const projOverrides = overrides[projectCode] ?? {};
  const projCustom = customCats[projectCode] ?? [];
  const projInactive = inactive[projectCode] ?? [];

  const rows: KategoriRow[] = useMemo(() => {
    const base: KategoriRow[] = getServiceCategories(projectCode).map((c) => {
      const ov = projOverrides[c.key] ?? {};
      return {
        key: c.key,
        label: ov.label ?? c.label,
        unit: ov.unit ?? c.unit,
        price: ov.price ?? getPriceFor(projectCode, locationId, c.key),
        deduction: ov.deduction ?? Boolean(c.deduction),
        active: !projInactive.includes(c.key),
        edited: c.key in projOverrides,
      };
    });
    const custom: KategoriRow[] = projCustom.map((c) => ({
      ...c,
      ...(projOverrides[c.key] ?? {}),
      active: !projInactive.includes(c.key),
      custom: true,
    }));
    return [...base, ...custom];
  }, [projectCode, locationId, projOverrides, projCustom, projInactive]);

  const addCategory = useCallback(
    (input: KategoriInput) => {
      const label = input.label.trim();
      if (!label) return;
      const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
      const row: KategoriRow = {
        key,
        label,
        unit: input.unit.trim() || "unit",
        price: Math.max(0, Math.round(input.price || 0)),
        deduction: input.deduction,
        active: true,
        custom: true,
      };
      setCustomCats((prev) => ({ ...prev, [projectCode]: [...(prev[projectCode] ?? []), row] }));
    },
    [projectCode],
  );

  const editCategory = useCallback(
    (key: string, input: KategoriInput) => {
      setOverrides((prev) => ({
        ...prev,
        [projectCode]: {
          ...(prev[projectCode] ?? {}),
          [key]: {
            label: input.label.trim(),
            unit: input.unit.trim() || "unit",
            price: Math.max(0, Math.round(input.price || 0)),
            deduction: input.deduction,
          },
        },
      }));
    },
    [projectCode],
  );

  const toggleActive = useCallback(
    (key: string) => {
      setInactive((prev) => {
        const cur = prev[projectCode] ?? [];
        const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
        return { ...prev, [projectCode]: next };
      });
    },
    [projectCode],
  );

  const activeCount = rows.filter((r) => r.active).length;

  return { rows, addCategory, editCategory, toggleActive, activeCount };
}
