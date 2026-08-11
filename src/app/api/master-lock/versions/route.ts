import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import {
  getMasterLock,
  listMasterVersions,
  commitMasterVersion,
  isMasterLocked,
} from "@/db/repositories/master-lock-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { listMasterEntities, buildVersionHistory } from "@/lib/mock/master-lock";

export const dynamic = "force-dynamic";

/**
 * GET /api/master-lock/versions?entityKey=
 *
 * The non-destructive version history for a master-data domain, newest first.
 * Falls back to the config-derived history when the DB is unavailable. Any
 * authenticated persona may read.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const entityKey = req.nextUrl.searchParams.get("entityKey")?.trim() ?? "";
  if (!entityKey) return NextResponse.json({ error: "entityKey wajib diisi." }, { status: 400 });

  try {
    const rows = await listMasterVersions(entityKey);
    if (rows.length === 0) throw new Error("empty");
    return NextResponse.json({
      source: "db",
      entityKey,
      count: rows.length,
      versions: rows.map((r) => ({
        version: r.version,
        changedBy: r.changedBy,
        summary: r.summary,
        at: r.createdAt,
      })),
    });
  } catch {
    const entity = listMasterEntities().find((e) => e.key === entityKey);
    if (!entity) return NextResponse.json({ error: "Domain master tidak dikenal." }, { status: 404 });
    const versions = buildVersionHistory(entity).map((v) => ({
      version: v.version,
      changedBy: v.changedBy,
      summary: v.summary,
      at: v.at,
    }));
    return NextResponse.json({ source: "config", entityKey, count: versions.length, versions });
  }
}

/**
 * POST /api/master-lock/versions — restore a master domain to an earlier version.
 * Body: { entityKey, version }.
 *
 * Restore is non-destructive: it commits a NEW version whose summary records the
 * rollback target, rather than deleting later versions. Refused when the domain
 * is locked (unlock it first). Authorization: Leader/Super Admin (canConfigure).
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat me-restore versi." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const entityKey = typeof body.entityKey === "string" ? body.entityKey.trim() : "";
  const targetVersion = Number(body.version);
  if (!entityKey) return NextResponse.json({ error: "entityKey wajib diisi." }, { status: 400 });
  if (!Number.isInteger(targetVersion) || targetVersion < 1) {
    return NextResponse.json({ error: "version harus bilangan bulat ≥ 1." }, { status: 422 });
  }

  try {
    const lock = await getMasterLock(entityKey);
    if (!lock) return NextResponse.json({ error: "Domain master tidak dikenal." }, { status: 404 });
    if (targetVersion >= lock.version) {
      return NextResponse.json({ error: "Versi tujuan harus lebih lama dari versi saat ini." }, { status: 422 });
    }
    if (await isMasterLocked(entityKey)) {
      return NextResponse.json({ error: "Domain terkunci — buka kunci sebelum restore." }, { status: 409 });
    }

    const newVersion = await commitMasterVersion(
      entityKey,
      `Restore ke versi ${targetVersion}`,
      persona.name,
    );
    await writeAuditLog({
      category: "master_lock",
      action: "master.restore",
      actor: persona.name,
      entityType: "master_domain",
      entityId: entityKey,
      detail: `Restore ${lock.label} ke versi ${targetVersion} (tercatat sebagai versi ${newVersion}).`,
    });
    return NextResponse.json({ ok: true, entityKey, restoredFrom: targetVersion, newVersion }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal me-restore (database tidak tersedia)." }, { status: 503 });
  }
}
