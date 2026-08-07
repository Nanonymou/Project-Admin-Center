import { NextResponse, type NextRequest } from "next/server";
import {
  createBackup,
  listBackups,
  listRestoreHistory,
  type BackupFilter,
} from "@/db/repositories/backup-repository";
import type { NewBackup } from "@/db/schema";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { requirePersona } from "@/lib/server/rbac";
import { buildBackups } from "@/lib/mock/backups";

export const dynamic = "force-dynamic";

/**
 * GET /api/backups?projectId=&status=&limit=
 * Lists backups and recent restore history. Backup & Restore is an
 * administrative function restricted to Super Admin. Falls back to mock backup
 * snapshots when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Backup & Restore hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("projectId") ?? undefined;
  const status = sp.get("status") ?? undefined;
  const limitRaw = Number(sp.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
  const filter: BackupFilter = { projectId, status, limit };

  try {
    const [backups, restores] = await Promise.all([listBackups(filter), listRestoreHistory(undefined, 50)]);
    return NextResponse.json({ source: "db", filter, backups, restores });
  } catch {
    let backups = buildBackups(12);
    if (status) backups = backups.filter((b) => b.status === status);
    return NextResponse.json({ source: "mock", filter, backups, restores: [] });
  }
}

/**
 * POST /api/backups
 * Body: { projectId?, kind?, label? }
 * Creates a timestamped database backup record. The label and storage key are
 * stamped with the creation time when not provided. Super Admin only.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Backup & Restore hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // Empty body is fine — all fields are optional.
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const projectId = typeof body.projectId === "string" ? body.projectId : undefined;
  const kind = body.kind === "incremental" ? "incremental" : "full";
  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim()
      : `Backup ${projectId ?? "ALL"} ${now.toISOString().slice(0, 19).replace("T", " ")}`;

  const values: NewBackup = {
    projectId,
    label,
    kind,
    status: "completed",
    storageKey: `backups/${projectId ?? "all"}/${stamp}.dump`,
    createdBy: persona.name,
    completedAt: now,
  };

  try {
    const backup = await createBackup(values);
    await writeAuditLog({
      projectId: projectId ?? null,
      category: "backup",
      action: "create",
      actor: persona.name,
      entityType: "backup",
      entityId: backup.id,
      detail: `Backup "${backup.label}" (${kind}) dibuat.`,
    }).catch(() => {});
    return NextResponse.json({ source: "db", backup }, { status: 201 });
  } catch (err) {
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Backup dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      backup: { ...values, id: stamp, createdAt: now.toISOString() },
    });
  }
}
