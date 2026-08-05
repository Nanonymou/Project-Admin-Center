import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";

export type PersonaRole = "super_admin" | "leader_admin" | "site_admin" | "viewer";

export type Persona = {
  id: string;
  name: string;
  initials: string;
  role: PersonaRole;
  roleLabel: string;
  scope: {
    /**
     * Empty array = access to all projects.
     */
    projects: string[];
    /**
     * Empty array = access to all locations within allowed projects.
     */
    locations: string[];
  };
  capabilities: {
    canExport: boolean;
    canSwitchWorkspace: boolean;
    canApprove: boolean;
    canConfigure: boolean;
  };
};

const allProjects = Array.from(new Set(MOCK_WORKSPACES.map((w) => w.projectCode)));

export const PERSONAS: Persona[] = [
  {
    id: "persona-super",
    name: "Andi Prasetya",
    initials: "AP",
    role: "super_admin",
    roleLabel: "Super Admin",
    scope: { projects: [], locations: [] },
    capabilities: { canExport: true, canSwitchWorkspace: true, canApprove: true, canConfigure: true },
  },
  {
    id: "persona-leader",
    name: "Randi Setiawan",
    initials: "RS",
    role: "leader_admin",
    roleLabel: "Leader Admin",
    scope: { projects: allProjects, locations: [] },
    capabilities: { canExport: true, canSwitchWorkspace: true, canApprove: true, canConfigure: true },
  },
  {
    id: "persona-site-km22",
    name: "Bagas Wicaksono",
    initials: "BW",
    role: "site_admin",
    roleLabel: "Site Admin — KM22",
    scope: { projects: ["BUMA"], locations: ["loc-km22"] },
    capabilities: { canExport: false, canSwitchWorkspace: false, canApprove: false, canConfigure: false },
  },
  {
    id: "persona-site-pomala",
    name: "Ika Rahmawati",
    initials: "IR",
    role: "site_admin",
    roleLabel: "Site Admin — Pomala",
    scope: { projects: ["POMALA"], locations: ["loc-pomala"] },
    capabilities: { canExport: false, canSwitchWorkspace: false, canApprove: false, canConfigure: false },
  },
  {
    id: "persona-site-muara",
    name: "Fajar Nugraha",
    initials: "FN",
    role: "site_admin",
    roleLabel: "Site Admin — Muara Badak",
    scope: { projects: ["PHSS"], locations: ["loc-muara-badak"] },
    capabilities: { canExport: false, canSwitchWorkspace: false, canApprove: false, canConfigure: false },
  },
  {
    id: "persona-viewer",
    name: "Dinda Ayu",
    initials: "DA",
    role: "viewer",
    roleLabel: "Viewer (Read-only)",
    scope: { projects: allProjects, locations: [] },
    capabilities: { canExport: false, canSwitchWorkspace: true, canApprove: false, canConfigure: false },
  },
];

export const DEFAULT_PERSONA_ID = "persona-leader";

export function getPersonaById(id: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
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
