import { NextResponse, type NextRequest } from "next/server";
import { canAccessProject, getPersonaById } from "@/lib/personas";

/** HTTP methods that mutate state. */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Roles allowed to WRITE to configuration/administration endpoints. Reads on the
 * same endpoints stay open (each handler guards its own read authorization); only
 * mutating requests are role-gated here so a Site Admin / Viewer cannot alter
 * master data, roles, users, or system parameters even if a handler check were
 * ever missed. Config-driven: derived from each persona's role, no per-route map.
 */
const CONFIG_WRITER_ROLES = new Set(["super_admin", "leader_admin"]);

/** Path prefixes whose write operations require a configuration-capable role. */
const CONFIG_WRITE_PREFIXES = [
  "/api/master",
  "/api/role",
  "/api/parameter-sistem",
  "/api/users",
  "/api/lock-period",
  "/api/unlock-period",
];

/**
 * Site-access limiter + role-gate middleware. Runs ahead of the data API routes:
 *  1. Requires an authenticated persona (`x-persona-id`) → 401 if missing.
 *  2. Rejects a request whose explicit project/location filter falls outside the
 *     persona's scope → 403, before the handler runs any query.
 *  3. Role-gates writes to configuration endpoints to Leader/Super Admin → 403.
 *  4. Stamps `x-persona-role` for downstream handlers/telemetry.
 *
 * This is a coarse early guard; each route still performs its own fine-grained
 * authorization (executive vs. tenant scope, per-row `canAccessLocation`). The
 * role-based site-list (`/api/sites`) and dev helpers are intentionally excluded
 * so personas can always discover the sites they may access.
 */
export function middleware(req: NextRequest) {
  const id = req.headers.get("x-persona-id");
  if (!id) {
    return NextResponse.json(
      { error: "Autentikasi diperlukan (x-persona-id)." },
      { status: 401 },
    );
  }

  const persona = getPersonaById(id);
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId");
  const locationId = sp.get("locationId");

  // Role gate: block writes to config/admin endpoints for non-configuring roles.
  const path = req.nextUrl.pathname;
  if (
    WRITE_METHODS.has(req.method) &&
    CONFIG_WRITE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) &&
    !CONFIG_WRITER_ROLES.has(persona.role)
  ) {
    return NextResponse.json(
      { error: "Perubahan konfigurasi hanya untuk Leader/Super Admin.", role: persona.role },
      { status: 403 },
    );
  }

  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json(
      { error: `Tidak ada akses ke project ${projectId}.`, role: persona.role },
      { status: 403 },
    );
  }

  if (
    locationId &&
    persona.scope.locations.length > 0 &&
    !persona.scope.locations.includes(locationId)
  ) {
    return NextResponse.json(
      { error: `Tidak ada akses ke lokasi ${locationId}.`, role: persona.role },
      { status: 403 },
    );
  }

  const res = NextResponse.next();
  res.headers.set("x-persona-role", persona.role);
  return res;
}

/**
 * Only guard the site-scoped data endpoints. `/api/sites` (role-based discovery)
 * and `/api/dev/*` (self-guarded dev helpers) are deliberately not matched.
 */
export const config = {
  matcher: [
    "/api/dashboard/:path*",
    "/api/kpi/:path*",
    "/api/margin/:path*",
    "/api/ranking/:path*",
    "/api/chart/:path*",
    "/api/reminders/:path*",
    "/api/notifications/:path*",
    "/api/calendar/:path*",
    "/api/timeline/:path*",
    "/api/approvals/:path*",
    "/api/invoices/:path*",
    "/api/daily-sales/:path*",
    "/api/daily-cost/:path*",
    "/api/top-performance/:path*",
    "/api/cutoff-monitoring/:path*",
    "/api/sales-comparison/:path*",
    "/api/cost-comparison/:path*",
    "/api/master/:path*",
    "/api/role/:path*",
    "/api/parameter-sistem/:path*",
    "/api/periods/:path*",
    "/api/lock-period/:path*",
    "/api/backups/:path*",
    "/api/audit-logs/:path*",
    "/api/compliance/:path*",
    "/api/cutoff-policy/:path*",
    "/api/attachments/:path*",
    "/api/project-performance/:path*",
    "/api/recycle-bin/:path*",
    "/api/users/:path*",
    "/api/storage/:path*",
    "/api/import-export/:path*",
    "/api/sla/:path*",
    "/api/perhitungan/:path*",
    "/api/evidence/:path*",
    "/api/cost-items/:path*",
    "/api/entry-change-history/:path*",
    "/api/submit-daily-cost/:path*",
    "/api/dana-cash/:path*",
    "/api/unlock-period/:path*",
    "/api/persetujuan-daily-sales/:path*",
    "/api/sales-change-history/:path*",
    "/api/workflow-approval/:path*",
  ],
};
