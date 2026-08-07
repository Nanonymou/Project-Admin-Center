import { NextResponse, type NextRequest } from "next/server";
import { listBackups, listRestoreHistory, type BackupFilter } from "@/db/repositories/backup-repository";
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
  if (persona.role !== "super_admin") {
    return NextResponse.json({ error: "Backup & Restore hanya untuk Super Admin." }, { status: 403 });
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
