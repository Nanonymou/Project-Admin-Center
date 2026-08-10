import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import type { PersonaRole } from "@/lib/personas";

/**
 * RBAC schema & multi-site mapping (config-driven) for the Kelola Pengguna
 * feature. Defines the role catalogue, a role → permission matrix, and a
 * managed-user model whose site access is expressed as an explicit
 * project/location mapping. Everything is data here — the User Management pages
 * read this and never hardcode who-can-do-what. Frontend-first: this is the
 * mock the UI drives until the users/roles API lands.
 */

export type { PersonaRole } from "@/lib/personas";

/** The functional modules access can be granted on. */
export type RbacModule =
  | "dashboard"
  | "daily_sales"
  | "daily_cost"
  | "invoice"
  | "approval"
  | "master_data"
  | "reports"
  | "user_management";

/** Actions a role may hold on a module. */
export type RbacAction = "view" | "create" | "edit" | "approve" | "configure" | "export";

export type RoleDefinition = {
  role: PersonaRole;
  label: string;
  description: string;
  /** Per-module allowed actions. An empty list means no access to that module. */
  permissions: Record<RbacModule, RbacAction[]>;
};

const ALL_MODULES: RbacModule[] = [
  "dashboard",
  "daily_sales",
  "daily_cost",
  "invoice",
  "approval",
  "master_data",
  "reports",
  "user_management",
];

const ALL_ACTIONS: RbacAction[] = ["view", "create", "edit", "approve", "configure", "export"];

export const RBAC_MODULE_LABEL: Record<RbacModule, string> = {
  dashboard: "Dashboard",
  daily_sales: "Daily Sales",
  daily_cost: "Daily Cost",
  invoice: "Invoice",
  approval: "Approval",
  master_data: "Master Data",
  reports: "Laporan",
  user_management: "Kelola Pengguna",
};

export const RBAC_ACTION_LABEL: Record<RbacAction, string> = {
  view: "Lihat",
  create: "Buat",
  edit: "Ubah",
  approve: "Setujui",
  configure: "Konfigurasi",
  export: "Ekspor",
};

/** Grant the same action set to every module. */
function everyModule(actions: RbacAction[]): Record<RbacModule, RbacAction[]> {
  return Object.fromEntries(ALL_MODULES.map((m) => [m, [...actions]])) as Record<RbacModule, RbacAction[]>;
}

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "super_admin",
    label: "Super Admin",
    description: "Akses penuh seluruh project, site, master data, dan pengelolaan pengguna.",
    permissions: everyModule(ALL_ACTIONS),
  },
  {
    role: "leader_admin",
    label: "Leader Admin",
    description: "Akses penuh site yang menjadi tanggung jawabnya; kelola master data dan approval.",
    permissions: {
      dashboard: ["view", "export"],
      daily_sales: ["view", "create", "edit", "export"],
      daily_cost: ["view", "create", "edit", "export"],
      invoice: ["view", "create", "edit", "export"],
      approval: ["view", "approve", "export"],
      master_data: ["view", "create", "edit", "configure"],
      reports: ["view", "export"],
      user_management: ["view"],
    },
  },
  {
    role: "site_admin",
    label: "Site Admin",
    description: "Operasional satu site: input harian, buat invoice, update progress, unggah dokumen.",
    permissions: {
      dashboard: ["view"],
      daily_sales: ["view", "create", "edit"],
      daily_cost: ["view", "create", "edit"],
      invoice: ["view", "create", "edit"],
      approval: ["view"],
      master_data: ["view"],
      reports: ["view"],
      user_management: [],
    },
  },
  {
    role: "viewer",
    label: "Viewer",
    description: "Hanya membaca dashboard dan laporan dalam cakupannya.",
    permissions: {
      dashboard: ["view"],
      daily_sales: ["view"],
      daily_cost: ["view"],
      invoice: ["view"],
      approval: ["view"],
      master_data: ["view"],
      reports: ["view", "export"],
      user_management: [],
    },
  },
];

export function listRoles(): RoleDefinition[] {
  return ROLE_DEFINITIONS;
}

export function getRoleDefinition(role: PersonaRole): RoleDefinition {
  return ROLE_DEFINITIONS.find((r) => r.role === role) ?? ROLE_DEFINITIONS[ROLE_DEFINITIONS.length - 1];
}

/** Does a role allow an action on a module? */
export function roleCan(role: PersonaRole, module: RbacModule, action: RbacAction): boolean {
  return getRoleDefinition(role).permissions[module]?.includes(action) ?? false;
}

export function rbacModules(): RbacModule[] {
  return ALL_MODULES;
}

export function rbacActions(): RbacAction[] {
  return ALL_ACTIONS;
}

// --- Managed users & multi-site mapping ----------------------------------

export type UserAccountStatus = "active" | "invited" | "suspended";

/** A single project→locations grant. Empty `locations` = all sites in project. */
export type SiteGrant = {
  projectCode: string;
  /** Location ids granted; empty means every location under the project. */
  locations: string[];
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: PersonaRole;
  status: UserAccountStatus;
  /**
   * Multi-site mapping. Empty array = all projects/all sites (used by
   * super_admin / org-wide roles).
   */
  siteAccess: SiteGrant[];
  createdAt: string; // ISO date
};

export const USER_STATUS_META: Record<
  UserAccountStatus,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  active: { label: "Aktif", variant: "success" },
  invited: { label: "Diundang", variant: "warning" },
  suspended: { label: "Ditangguhkan", variant: "danger" },
};

function slugEmail(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@tpb.co.id`;
}

const distinctProjects = Array.from(new Set(MOCK_WORKSPACES.map((w) => w.projectCode)));

/**
 * Seeded managed-user directory: one org-wide super admin, a leader per project
 * cluster, and a site admin per location — each with an explicit site mapping.
 */
export const MANAGED_USERS: ManagedUser[] = [
  {
    id: "usr-super",
    name: "Andi Prasetya",
    email: "andi.prasetya@tpb.co.id",
    role: "super_admin",
    status: "active",
    siteAccess: [],
    createdAt: "2025-01-06",
  },
  {
    id: "usr-leader",
    name: "Randi Setiawan",
    email: "randi.setiawan@tpb.co.id",
    role: "leader_admin",
    status: "active",
    siteAccess: distinctProjects.map((projectCode) => ({ projectCode, locations: [] })),
    createdAt: "2025-01-10",
  },
  ...MOCK_WORKSPACES.map<ManagedUser>((w, i) => ({
    id: `usr-site-${w.locationId}`,
    name: `Admin ${w.locationName}`,
    email: slugEmail(`admin ${w.locationName}`),
    role: "site_admin",
    status: i % 5 === 3 ? "invited" : "active",
    siteAccess: [{ projectCode: w.projectCode, locations: [w.locationId] }],
    createdAt: "2025-02-01",
  })),
  {
    id: "usr-viewer",
    name: "Dinda Ayu",
    email: "dinda.ayu@tpb.co.id",
    role: "viewer",
    status: "active",
    siteAccess: distinctProjects.map((projectCode) => ({ projectCode, locations: [] })),
    createdAt: "2025-03-12",
  },
];

export function listManagedUsers(): ManagedUser[] {
  return MANAGED_USERS;
}

/** Human-readable summary of a user's site mapping. */
export function describeSiteAccess(user: ManagedUser): string {
  if (user.siteAccess.length === 0) return "Semua project & site";
  const parts = user.siteAccess.map((g) => {
    if (g.locations.length === 0) return `${g.projectCode} (semua site)`;
    const names = g.locations.map(
      (locId) => MOCK_WORKSPACES.find((w) => w.locationId === locId)?.locationName ?? locId,
    );
    return `${g.projectCode}: ${names.join(", ")}`;
  });
  return parts.join(" · ");
}

/** Count of distinct locations a user can reach (Infinity-like for org-wide). */
export function countAccessibleSites(user: ManagedUser): number {
  if (user.siteAccess.length === 0) return MOCK_WORKSPACES.length;
  const set = new Set<string>();
  for (const g of user.siteAccess) {
    if (g.locations.length === 0) {
      MOCK_WORKSPACES.filter((w) => w.projectCode === g.projectCode).forEach((w) => set.add(w.locationId));
    } else {
      g.locations.forEach((l) => set.add(l));
    }
  }
  return set.size;
}
