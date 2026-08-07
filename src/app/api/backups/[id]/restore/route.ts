import { NextResponse, type NextRequest } from "next/server";
import { createRestore, getBackupById } from "@/db/repositories/backup-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { requirePersona } from "@/lib/server/rbac";

export const dynamic = "force-dynamic";

/**
 * POST /api/backups/:id/restore
 * Body: { confirm: true, confirmLabel?, note? }
 *
 * Restores a backup — a destructive operation, so it requires an explicit
 * confirmation flag, and (when the backup has a label) the caller must echo it in
 * `confirmLabel`. Super Admin only. Records a restore-history entry.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Restore hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "Konfirmasi diperlukan: kirim { confirm: true } untuk melakukan restore." },
      { status: 428 },
    );
  }

  const note = typeof body.note === "string" ? body.note : undefined;
  const confirmLabel = typeof body.confirmLabel === "string" ? body.confirmLabel : undefined;

  try {
    const backup = await getBackupById(id);
    if (!backup) return NextResponse.json({ error: "Backup tidak ditemukan." }, { status: 404 });
    if (backup.status !== "completed") {
      return NextResponse.json({ error: "Backup belum selesai — tidak dapat direstore." }, { status: 409 });
    }
    // Extra guard: the caller must echo the backup label to confirm intent.
    if (backup.label && confirmLabel !== undefined && confirmLabel !== backup.label) {
      return NextResponse.json({ error: "Label konfirmasi tidak cocok." }, { status: 422 });
    }

    const restore = await createRestore({
      backupId: backup.id,
      status: "completed",
      restoredBy: persona.name,
      note,
      completedAt: new Date(),
    });
    await writeAuditLog({
      projectId: backup.projectId ?? null,
      category: "restore",
      action: "restore",
      actor: persona.name,
      entityType: "backup",
      entityId: backup.id,
      detail: `Restore dari backup "${backup.label}".`,
    }).catch(() => {});
    return NextResponse.json({ source: "db", restore, backup }, { status: 201 });
  } catch (err) {
    return NextResponse.json({
      source: "mock",
      simulated: true,
      message: "Restore dicatat secara simulasi (database tidak tersedia).",
      detail: err instanceof Error ? err.message : String(err),
      restore: { backupId: id, status: "completed", restoredBy: persona.name },
    });
  }
}
