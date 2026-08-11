import type { PersonaRole } from "@/lib/personas";
import { NAV_SECTIONS, type NavSection } from "@/lib/mock/nav";

/**
 * Role → navigation access rules (config-driven). Defines which nav sections a
 * role may see and any individual items denied within an allowed section. The
 * dynamic menu on the Hak Akses page and the app shell both derive the visible
 * menu from this single source, so access stays consistent. Cross-site / admin
 * surfaces are withheld from Site Admin and Viewer; Leader/Super Admin see all.
 */
export type NavAccessRule = {
  /** "all" grants every section; otherwise an allow-list of section labels. */
  sections: "all" | string[];
  /** Hrefs explicitly hidden even when their section is allowed. */
  denyHrefs?: string[];
};

export const ROLE_NAV_ACCESS: Record<PersonaRole, NavAccessRule> = {
  super_admin: { sections: "all" },
  leader_admin: { sections: "all" },
  site_admin: {
    sections: ["Overview", "Operasional"],
    // Cross-site / leadership surfaces are not available to a single-site admin.
    denyHrefs: [
      "/dashboard",
      "/ranking",
      "/leader",
      "/leader-workspace",
      "/margin",
      "/performance",
      "/project-performance",
      "/sales-compare",
      "/cost-compare",
      "/audit-log",
      "/comparison",
    ],
  },
  viewer: {
    sections: ["Overview", "Operasional"],
    denyHrefs: ["/leader", "/leader-workspace", "/audit-log", "/comparison"],
  },
};

/** Whether a role may see a given section. */
export function canAccessSection(role: PersonaRole, sectionLabel: string): boolean {
  const rule = ROLE_NAV_ACCESS[role];
  return rule.sections === "all" || rule.sections.includes(sectionLabel);
}

/** Whether a role may see a given nav item (by href), within an allowed section. */
export function canAccessNavHref(role: PersonaRole, sectionLabel: string, href: string): boolean {
  if (!canAccessSection(role, sectionLabel)) return false;
  const rule = ROLE_NAV_ACCESS[role];
  return !(rule.denyHrefs ?? []).includes(href);
}

/**
 * Whether a role may open a given path. Resolves the path to its nav item
 * (exact match or nested sub-route) and applies the section/href rules. Paths
 * not backed by a nav item (e.g. `/login`, the root) are allowed by default so
 * the guard never traps utility routes.
 */
export function isPathAllowedForRole(role: PersonaRole, pathname: string): boolean {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return canAccessNavHref(role, section.label, item.href);
      }
    }
  }
  return true;
}

/**
 * Whether a role may view the Audit Log (system/security trail). Restricted to
 * Leader Admin / Super Admin — a Site Admin or Viewer must never see privileged
 * configuration/security events. Single source of truth for the Audit Log guard,
 * consumed by the page and mirrored by the nav deny-list.
 */
export function canViewAuditLog(role: PersonaRole): boolean {
  return role === "leader_admin" || role === "super_admin";
}

/** The default landing route for a role — where a denied navigation redirects. */
export function landingForRole(role: PersonaRole): string {
  switch (role) {
    case "site_admin":
      return "/site-workspace";
    case "viewer":
      return "/activity";
    default:
      return "/dashboard";
  }
}

/**
 * The navigation a role may see — NAV_SECTIONS filtered down to the sections and
 * items the role can access. Empty sections are dropped.
 */
export function filterNavForRole(role: PersonaRole): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccessNavHref(role, section.label, item.href)),
  })).filter((section) => section.items.length > 0);
}
