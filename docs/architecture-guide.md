# Project Admin Center — Comprehensive Architecture Guide & Master Prompts

> Living reference for how **Project Admin Center** is built and how to extend it
> safely. Read this before adding a page, a master-data config, an API route, or
> a new site/project. The system is a **Configuration-Driven, Multi-Site
> Administration ERP** for mining-catering operations.

---

## 1. Guiding Principles

1. **Configuration Driven, not hardcoded.** Business rules (service categories,
   pricing, tax, cut-off, workflow, timeframe) live as data/config, never as
   `if (project === 'BUMA')`. Adding a project or site is a config change, not a
   code change.
2. **Multi-tenant by `ProjectID` + `LocationID`.** Every transaction is scoped
   by project and location so site data stays logically isolated.
3. **Frontend-first.** UI pages are built against config/mock data that assume
   the API contract; backend routes implement that contract later. This keeps
   pages shippable and demoable before the database is wired.
4. **RBAC everywhere.** What a persona can see and do is filtered by role,
   project access, and location access — enforced in both UI and API.
5. **Non-destructive master data.** Master changes are versioned/traceable
   (change history, recycle bin) rather than overwritten.

---

## 2. Hierarchy: Project → Location → Workspace

The core domain model (feature **Master Project & Location**):

```
Project (e.g. BUMA Tabang, Pomala, PHSS)
  └── Location (e.g. KM22, KM92, Pomala, Muara Badak)
        └── Workspace   ← the unit a user actually operates in
```

- A **Project** carries the business ruleset: service categories, invoice
  period, tax profile, workflow, formula set.
- A **Location** belongs to a project and carries per-site overrides (e.g. a
  per-location price multiplier via `getPriceFor`).
- A **Workspace** is the `{ projectId, projectCode, projectName, client,
  locationId, locationName, invoicePeriod }` tuple a user switches into.
  Source of truth (frontend/mock): `src/lib/mock/workspaces.ts` →
  `MOCK_WORKSPACES`.

A **Leader Admin** may open/switch any workspace they own without logging out;
a **Site Admin** is bound to a single site. Access is decided by
`canAccessLocation(persona, locationId, projectCode)` in `src/lib/personas.ts`.

Adding a site/project = add a `Workspace` row (and, later, a DB `projects` /
`master-areas` row) plus its service-category keys. **No component changes.**

---

## 3. Architecture Layers (Modular Monolith)

Next.js App Router, one source / one DB / one deployment for many projects.

```
UI (Client Components)  src/components/**, src/app/**/page.tsx
        │  fetch()
API Route Handlers      src/app/api/**/route.ts
        │
Business Services       src/lib/server/services/**      ← domain logic, engines
        │
Repositories            src/db/repositories/**
        │
Drizzle ORM + schema    src/db/schema/**                ← tables + SQL views
        │
PostgreSQL (Neon)
```

- **Guards**: `src/lib/server/guards/**` enforce RBAC/period-lock at the API edge.
- **Config/mock**: `src/lib/mock/**` (46 files) is the frontend-first source of
  truth that mirrors the eventual DB contract (service categories, pricing, tax,
  areas, cutoff, workflow, etc.).
- **Path alias**: `@/*` → `./src/*` (see `tsconfig.json`).

### Tech Stack
Next.js 15 · React 19 · TypeScript 5 · Tailwind CSS · shadcn-style UI
(`src/components/ui`) · Drizzle ORM · Neon PostgreSQL · Recharts · Vercel Blob.

---

## 4. Configuration-Driven Engines

| Concern            | Config source (`src/lib/mock/…`)         | Key accessor(s)                         |
| ------------------ | ---------------------------------------- | --------------------------------------- |
| Service categories | `service-config.ts`                      | `getServiceCategories(projectCode)`     |
| Master pricing     | `pricing-config.ts`                      | `getPriceFor`, `getPriceListFor`, `getPricedCategories` |
| Tax (PPN/PB1/…)    | `tax-config.ts`                          | `computeTax(base, projectCode)`         |
| Areas per location | `area-config.ts`                         | `getAreasFor(locationId, name)`         |
| Cut-off (H+1)      | `cutoff-config.ts`                       | period-lock helpers                     |
| Workflow / SLA     | `approval-timeframe-config.ts`, `approval-timeline.ts` | resolution services       |
| Penalty / BBM      | `penalty-config.ts`, `bbm-config.ts`     | formula engine                          |

The DB mirror of these lives under `src/db/schema/` (`master-categories`,
`master-prices`, `master-areas`, `master-timeframes`, `sla-targets`, …) plus
read-optimized SQL **views** (`*-view.ts`) for dashboards.

**Rule:** a new business rule is a new row/entry in one of these, surfaced by an
accessor. Components consume the accessor, never a literal.

---

## 5. RBAC & Personas

Roles (`src/lib/personas.ts`): `super_admin`, `leader_admin`, `site_admin`,
`viewer`.

- `super_admin` / `leader_admin` — full/multi-site access, master-data edits.
- `site_admin` — single-site operations (daily sales/cost, invoice, upload).
- `viewer` — read-only.

Every page filters its workspaces with `canAccessLocation(...)`; every mutating
API re-checks role + location in a guard. **Never trust the client scope alone.**

---

## 6. Directory Map (where things go)

```
src/
  app/
    <feature>/page.tsx          ← thin: renders a client component
    api/<resource>/route.ts     ← REST handlers (GET/POST/PATCH…)
  components/
    <feature>/<feature>-client.tsx   ← page body ("use client")
    ui/                          ← shared primitives (Button, Card, Dialog, Badge, Input…)
    app/                         ← shell (PageHeader, nav)
  lib/
    mock/                        ← config-driven data + accessors (frontend contract)
    hooks/                       ← reusable client hooks (e.g. use-kategori-store)
    server/services/             ← domain logic / engines
    server/guards/               ← RBAC & lock enforcement
    personas.ts, utils.ts
  db/
    schema/                      ← Drizzle tables + views
    repositories/                ← data access
```

Nav registry: `src/lib/mock/nav.ts` (grouped sidebar; Master Data group holds
config pages).

---

## 7. Conventions

- Page component is a thin server component that renders a `"use client"`
  `<Feature>Client`. Keep data-fetching/logic in the client or a service.
- Reuse `src/components/ui/*` primitives; match existing Badge variants
  (`success | warning | danger | info | muted | outline | secondary | default`).
- Money via `formatCurrency`; dates via `formatDate`/`formatDateTime` from
  `@/lib/utils`.
- Indonesian UI copy; concise, ERP tone.
- Frontend-first edits are **session-local** (React state or a hook store like
  `useKategoriStore`) until the backend lands — keyed by `projectCode` or
  `locationId` so switching scope shows that scope's own edits.
- Every master change should be surface-able in a change-history/riwayat view.

---

## 8. Master Prompts (reusable)

Copy-paste starting points for Claude Code. Fill the `<…>` slots. Each assumes
**config-driven + persona-scoped + frontend-first** unless stated.

### 8.1 New Master-Data page
```
Build a config-driven "<Feature>" page under src/app/<slug>/page.tsx +
src/components/<slug>/<slug>-client.tsx. Site/project picker filtered by
canAccessLocation(persona,…). Source data from src/lib/mock/<config>.ts via its
accessor — never hardcode per-project values. Table with persona-gated actions
(viewers read-only). Register it in src/lib/mock/nav.ts under the right group.
Match ui/* primitives, formatCurrency/formatDate, Indonesian copy. Typecheck +
next build must pass.
```

### 8.2 Add a business rule to config
```
Extend src/lib/mock/<config>.ts with <rule> keyed by project code (and optional
per-location override). Expose an accessor get<Rule>(projectCode[, locationId]).
Update the DB mirror in src/db/schema/<table>.ts. Do NOT branch on project name
in any component — consume the accessor.
```

### 8.3 New API route (backend layer)
```
Implement src/app/api/<resource>/route.ts (GET/POST/…). Validate input with zod,
enforce RBAC + period-lock via a src/lib/server/guards guard, put domain logic in
src/lib/server/services/<name>-service.ts, read/write through a repository +
Drizzle. Scope every query by projectId/locationId. Mirror the response shape the
frontend page already assumes.
```

### 8.4 Add/switch a site or project
```
Add a Workspace row to MOCK_WORKSPACES (src/lib/mock/workspaces.ts) and its
service-category keys in service-config.ts. Add a DB projects/master-areas row
later. Verify the site appears only for personas whose access includes it. No
component edits should be required.
```

### 8.5 Change-history / audit view
```
Add a "Riwayat Perubahan <X>" view: a mock builder in src/lib/mock/<x>-change-log.ts
producing newest-first entries (create/update/activate/deactivate with
before/after, editor, timestamp), plus a presentational modal. Merge this
session's edits ahead of the seeded history so the user sees their own actions.
```

---

## 9. Acceptance Gate (Definition of Done)

- Project/Location/rule changes are 100% config/UI — no per-project code branch.
- SLA indicators color-correct (green/yellow/red/blue); Cut-Off H+1 locks past
  entries; Excel import validates duplicates.
- Data isolated by `projectId` + `locationId` at every layer.
- `npx tsc --noEmit` clean and `npm run build` green.

---

_Reference order when documents conflict: PRD → TSD → DB/ERD → Frontend Spec →
Backend Spec → Roadmap → AI Rules (PRD wins)._
