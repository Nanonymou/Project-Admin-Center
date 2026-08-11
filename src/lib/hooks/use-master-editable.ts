"use client";

import { usePersona } from "@/components/providers/persona-provider";
import { listMasterEntities } from "@/lib/mock/master-lock";

export type MasterEditable = {
  /** True only when the persona may edit AND the master is not locked. */
  editable: boolean;
  /** Current lock state of the master entity. */
  locked: boolean;
  /** Whether the persona's role is allowed to manage master data at all. */
  canManageRole: boolean;
  /** Human-readable reason editing is disabled (empty when editable). */
  reason: string;
};

/**
 * Resolves whether a master-data form should be editable, enforcing the two
 * rules from PRD §Master Lock: a master is read-only when it is locked, or when
 * the persona is not a Leader/Super Admin. Frontend-first — it reads the base
 * lock state from the Master Lock registry mock. Backend RBAC + the real lock
 * table remain the source of truth once wired.
 */
export function useMasterEditable(entityKey: string): MasterEditable {
  const { persona } = usePersona();
  const canManageRole = persona.role === "super_admin" || persona.role === "leader_admin";
  const locked = listMasterEntities().find((e) => e.key === entityKey)?.locked ?? false;

  let reason = "";
  if (!canManageRole) reason = "Hanya Leader/Super Admin yang dapat mengubah Master Data.";
  else if (locked) reason = "Master Data ini terkunci. Buka kunci di Master Lock & Versi untuk mengubah.";

  return { editable: canManageRole && !locked, locked, canManageRole, reason };
}
