import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

/**
 * Persona simulation (frontend-first "auth").
 *
 * There is no real login yet — the app simulates who is signed in by picking a
 * persona. Each persona carries a role (drives RBAC + the dynamic menu), a scope
 * (which projects/locations they can reach) and a capability set (what actions
 * they may take). The active persona id is sent to the API via the
 * `x-persona-id` header and remembered in localStorage.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EDITING THE DUMMY DATA
 * These personas are dummy/mock data — edit `PERSONA_SEEDS` below to add, remove
 * or change who can sign in. Each seed is intentionally terse: give it an id,
 * name, role and scope, and the role's default label + capabilities are filled
 * in automatically (override per-persona only when needed). No other file needs
 * to change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type PersonaRole = "super_admin" | "leader_admin" | "site_admin" | "viewer";

export type PersonaCapabilities = {
  canExport: boolean;
  canSwitchWorkspace: boolean;
  canApprove: boolean;
  canConfigure: boolean;
};

export type PersonaScope = {
  /** Empty array = access to all projects. */
  projects: string[];
  /** Empty array = access to all locations within allowed projects. */
  locations: string[];
};

export type Persona = {
  id: string;
  name: string;
  /** Login email (dummy) — used by the NextAuth credentials provider. */
  email: string;
  initials: string;
  role: PersonaRole;
  roleLabel: string;
  scope: PersonaScope;
  capabilities: PersonaCapabilities;
};

/**
 * Shared demo password for every persona (dummy auth). Real deployments should
 * replace the credentials provider with per-user hashed passwords; this exists
 * only so the frontend-first login has something to check. Overridable via the
 * `DEMO_PASSWORD` env var.
 */
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demo123";

/** All distinct project codes known to the app (derived from the workspaces). */
const ALL_PROJECTS = Array.from(new Set(MOCK_WORKSPACES.map((w) => w.projectCode)));

/**
 * Per-role defaults. A persona inherits its role's label and capabilities unless
 * a seed overrides them — so the six personas below stay short and consistent,
 * and a new role only needs to be described once here.
 */
const ROLE_DEFAULTS: Record<PersonaRole, { label: string; capabilities: PersonaCapabilities }> = {
  super_admin: {
    label: "Super Admin",
    capabilities: { canExport: true, canSwitchWorkspace: true, canApprove: true, canConfigure: true },
  },
  leader_admin: {
    label: "Leader Admin",
    capabilities: { canExport: true, canSwitchWorkspace: true, canApprove: true, canConfigure: true },
  },
  site_admin: {
    label: "Site Admin",
    capabilities: { canExport: false, canSwitchWorkspace: false, canApprove: false, canConfigure: false },
  },
  viewer: {
    label: "Viewer (Read-only)",
    capabilities: { canExport: false, canSwitchWorkspace: true, canApprove: false, canConfigure: false },
  },
};

/** A concise persona definition; anything omitted falls back to the role default. */
type PersonaSeed = {
  id: string;
  name: string;
  email: string;
  role: PersonaRole;
  /** Overrides the role's default label (e.g. to name the specific site). */
  roleLabel?: string;
  /** Omit for org-wide scope (all projects, all locations). */
  scope?: Partial<PersonaScope>;
  /** Override only the capabilities that differ from the role default. */
  capabilities?: Partial<PersonaCapabilities>;
};

/**
 * The editable dummy roster. Add/remove/change entries here — everything else
 * (labels, capabilities, initials) is derived.
 */
const PERSONA_SEEDS: PersonaSeed[] = [
  { id: "persona-super", name: "Andi Prasetya", email: "andi@tpb.co.id", role: "super_admin" },
  {
    id: "persona-leader",
    name: "Randi Setiawan",
    email: "randi@tpb.co.id",
    role: "leader_admin",
    scope: { projects: ALL_PROJECTS },
  },
  {
    id: "persona-site-km22",
    name: "Bagas Wicaksono",
    email: "bagas@tpb.co.id",
    role: "site_admin",
    roleLabel: "Site Admin — KM22",
    scope: { projects: ["BUMA"], locations: ["loc-km22"] },
  },
  {
    id: "persona-site-pomala",
    name: "Ika Rahmawati",
    email: "ika@tpb.co.id",
    role: "site_admin",
    roleLabel: "Site Admin — Pomala",
    scope: { projects: ["POMALA"], locations: ["loc-pomala"] },
  },
  {
    id: "persona-site-muara",
    name: "Fajar Nugraha",
    email: "fajar@tpb.co.id",
    role: "site_admin",
    roleLabel: "Site Admin — Muara Badak",
    scope: { projects: ["PHSS"], locations: ["loc-muara-badak"] },
  },
  {
    id: "persona-viewer",
    name: "Dinda Ayu",
    email: "dinda@tpb.co.id",
    role: "viewer",
    scope: { projects: ALL_PROJECTS },
  },
];

/** Build initials from a display name, e.g. "Randi Setiawan" → "RS". */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Expand a terse seed into a full persona using the role defaults. */
function buildPersona(seed: PersonaSeed): Persona {
  const defaults = ROLE_DEFAULTS[seed.role];
  return {
    id: seed.id,
    name: seed.name,
    email: seed.email,
    initials: initialsOf(seed.name),
    role: seed.role,
    roleLabel: seed.roleLabel ?? defaults.label,
    scope: {
      projects: seed.scope?.projects ?? [],
      locations: seed.scope?.locations ?? [],
    },
    capabilities: { ...defaults.capabilities, ...seed.capabilities },
  };
}

export const PERSONAS: Persona[] = PERSONA_SEEDS.map(buildPersona);

export const DEFAULT_PERSONA_ID = "persona-leader";

export function getPersonaById(id: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

/** Look up a persona by login email (case-insensitive). Used at sign-in. */
export function getPersonaByEmail(email: string): Persona | undefined {
  const needle = email.trim().toLowerCase();
  return PERSONAS.find((p) => p.email.toLowerCase() === needle);
}

/**
 * Given a persona and a candidate project/location, is it inside their scope?
 */
export function canAccessProject(persona: Persona, projectCode: string) {
  if (persona.scope.projects.length === 0) return true;
  return persona.scope.projects.includes(projectCode);
}

export function canAccessLocation(persona: Persona, locationId: string, projectCode: string) {
  if (!canAccessProject(persona, projectCode)) return false;
  if (persona.scope.locations.length === 0) return true;
  return persona.scope.locations.includes(locationId);
}
