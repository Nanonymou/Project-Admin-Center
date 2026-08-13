import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  listMasterLocks,
  getMasterLock,
  setMasterLockState,
  upsertMasterLock,
} from "@/db/repositories/master-lock-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { listMasterEntities } from "@/lib/mock/master-lock";

export const dynamic = "force-dynamic";

/**
 * GET /api/master-lock — the lockable master-data domains with their current lock
 * state and version. Falls back to the config catalogue when the DB is
 * unavailable. Any authenticated persona may read.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const rows = await listMasterLocks();
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      count: rows.length,
      entities: rows.map((r) => ({
        key: r.entityKey,
        label: r.label,
        category: r.category,
        locked: r.locked,
        version: r.version,
        lastModifiedBy: r.lastModifiedBy,
        lastModifiedAt: r.lastModifiedAt,
      })),
    });
  } catch {
    const entities = listMasterEntities().map((e) => ({
      key: e.key,
      label: e.label,
      category: e.category,
      href: e.href,
      locked: e.locked,
      version: e.version,
      lastModifiedBy: e.lastModifiedBy,
      lastModifiedAt: e.lastModifiedAt,
    }));
    return NextResponse.json({ source: "config", count: entities.length, entities });
  }
}

/**
 * POST /api/master-lock — register a NEW lockable master-data domain generically.
 * Body: { entityKey, label, category?, locked?, version? }
 *
 * This lets a newly-added Master Data type join the lock/version model without a
 * code change: it is upserted into the catalogue and thereafter appears in the
 * lock list and can be locked/unlocked and versioned like the built-in domains.
 * `entityKey` is a stable lowercase slug. Restricted to Super Admin.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin yang dapat mendaftarkan domain master." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const entityKey = typeof body.entityKey === "string" ? body.entityKey.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const locked = Boolean(body.locked);
  const versionRaw = Number(body.version);
  const version = Number.isInteger(versionRaw) && versionRaw >= 1 ? versionRaw : 1;

  if (!/^[a-z][a-z0-9_]*$/.test(entityKey)) {
    return NextResponse.json({ error: "entityKey harus slug huruf kecil/underscore (mis. master_baru)." }, { status: 422 });
  }
  if (!label) {
    return NextResponse.json({ error: "label wajib diisi." }, { status: 422 });
  }

  try {
    const existing = await getMasterLock(entityKey);
    await upsertMasterLock({ entityKey, label, category, locked, version, lastModifiedBy: persona.name });
    await writeAuditLog({
      category: "master_lock",
      action: existing ? "master.domain.update" : "master.domain.register",
      actor: persona.name,
      entityType: "master_domain",
      entityId: entityKey,
      detail: `${existing ? "Perbarui" : "Daftarkan"} domain master ${label}.`,
    });
    return NextResponse.json({ ok: true, entityKey }, { status: existing ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "Gagal mendaftarkan domain (database tidak tersedia)." }, { status: 503 });
  }
}

/**
 * PATCH /api/master-lock — lock or unlock a master-data domain.
 * Body: { entityKey, locked }.
 *
 * Locking master data is a high-privilege action that freezes a whole domain's
 * configuration, so it is restricted to Super Admin (a Leader may configure
 * within a domain but not seal it). Records an audit-log entry.
 */
export async function PATCH(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (persona.role !== "super_admin") {
    return NextResponse.json({ error: "Hanya Super Admin yang dapat mengunci/membuka master data." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const entityKey = typeof body.entityKey === "string" ? body.entityKey.trim() : "";
  const locked = Boolean(body.locked);
  if (!entityKey) return NextResponse.json({ error: "entityKey wajib diisi." }, { status: 400 });

  try {
    // Ensure the domain exists before toggling.
    const existing = await getMasterLock(entityKey);
    if (!existing) return NextResponse.json({ error: "Domain master tidak dikenal." }, { status: 404 });

    const row = await setMasterLockState(entityKey, locked, persona.name);
    await writeAuditLog({
      category: "master_lock",
      action: locked ? "master.lock" : "master.unlock",
      actor: persona.name,
      entityType: "master_domain",
      entityId: entityKey,
      detail: `${locked ? "Kunci" : "Buka kunci"} master ${row?.label ?? entityKey}.`,
    });
    return NextResponse.json({ ok: true, entityKey, locked });
  } catch {
    return NextResponse.json({ error: "Gagal mengubah status kunci (database tidak tersedia)." }, { status: 503 });
  }
}
