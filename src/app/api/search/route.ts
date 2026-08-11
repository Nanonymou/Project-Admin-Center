import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { NAV_SECTIONS } from "@/lib/mock/nav";
import { SITE_KPI } from "@/lib/mock/site-kpi";
import { listManagedUsers } from "@/lib/mock/rbac";
import { listCustomerVendors } from "@/lib/mock/customer-vendor";
import { listInvoiceTypes } from "@/lib/mock/invoice-type-config";

export const dynamic = "force-dynamic";

type ResultKind = "page" | "site" | "user" | "party" | "invoice_type";

type SearchResult = { id: string; kind: ResultKind; title: string; subtitle: string; href: string };

/**
 * GET /api/search?q=&limit=
 *
 * Global search combining five data types — pages (nav), sites, managed users,
 * customer/vendor parties, and invoice types — into one ranked, grouped result
 * set. Persona-scoped: only accessible sites appear, and users are visible to
 * configuring roles. Config-derived (frontend-first); mirrors the /search page.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().toLowerCase();
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;

  if (!q) return NextResponse.json({ query: "", count: 0, results: {}, groups: [] });

  const index: SearchResult[] = [];

  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      index.push({ id: `page-${item.href}`, kind: "page", title: item.label, subtitle: `${section.label} · ${item.href}`, href: item.href });
    }
  }
  for (const s of SITE_KPI.filter((x) => canAccessLocation(persona, x.locationId, x.projectCode))) {
    index.push({ id: `site-${s.locationId}`, kind: "site", title: s.locationName, subtitle: `${s.projectName} · ${s.projectCode}`, href: `/site/${s.locationId}` });
  }
  if (persona.capabilities.canConfigure) {
    for (const u of listManagedUsers()) {
      index.push({ id: `user-${u.id}`, kind: "user", title: u.name, subtitle: `${u.email} · ${u.role}`, href: `/hak-akses?user=${u.id}` });
    }
  }
  for (const p of listCustomerVendors()) {
    index.push({ id: `party-${p.id}`, kind: "party", title: p.name, subtitle: `${p.code} · ${p.category}`, href: `/master-customer-vendor?code=${encodeURIComponent(p.code)}` });
  }
  for (const t of listInvoiceTypes()) {
    index.push({ id: `invtype-${t.key}`, kind: "invoice_type", title: t.label, subtitle: `Jenis Invoice · potongan ${(t.deductionRate * 100).toFixed(1)}%`, href: "/jenis-invoice" });
  }

  const matches = index.filter((r) => `${r.title} ${r.subtitle}`.toLowerCase().includes(q)).slice(0, limit);

  // Group by kind for the UI.
  const groups: { kind: ResultKind; count: number; items: SearchResult[] }[] = [];
  for (const kind of ["page", "site", "user", "party", "invoice_type"] as ResultKind[]) {
    const items = matches.filter((r) => r.kind === kind);
    if (items.length > 0) groups.push({ kind, count: items.length, items });
  }

  return NextResponse.json({ query: q, count: matches.length, groups });
}
