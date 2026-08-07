import { NextResponse, type NextRequest } from "next/server";
import { latestStorageMetrics } from "@/db/repositories/monitoring-repository";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { buildStorageByProject } from "@/lib/mock/user-monitoring";

export const dynamic = "force-dynamic";

/**
 * GET /api/storage?projectId=
 * Storage usage statistics per project (and per category), from the latest
 * storage-metric snapshots. Administrative view restricted to Leader/Super
 * Admin; a projectId narrows to one project the persona may access. Falls back to
 * mock storage data when the database is unavailable.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Monitoring storage hanya untuk Leader/Super Admin." }, { status: 403 });
  }

  const projectId = req.nextUrl.searchParams.get("projectId") ?? undefined;
  if (projectId && !canAccessProject(persona, projectId)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectId}.` }, { status: 403 });
  }

  try {
    const metrics = await latestStorageMetrics(projectId);
    // Roll up per project across categories, keeping the category breakdown.
    const map = new Map<
      string,
      { projectCode: string; totalBytes: number; totalItems: number; byCategory: { category: string; sizeBytes: number; itemCount: number }[] }
    >();
    for (const m of metrics) {
      const key = m.projectId ?? "ALL";
      const entry = map.get(key) ?? { projectCode: key, totalBytes: 0, totalItems: 0, byCategory: [] };
      entry.totalBytes += m.sizeBytes;
      entry.totalItems += m.itemCount;
      entry.byCategory.push({ category: m.category, sizeBytes: m.sizeBytes, itemCount: m.itemCount });
      map.set(key, entry);
    }
    const projects = Array.from(map.values()).sort((a, b) => b.totalBytes - a.totalBytes);
    return NextResponse.json({ source: "db", projectId, projects });
  } catch {
    let projects = buildStorageByProject();
    if (projectId) projects = projects.filter((p) => p.code === projectId);
    return NextResponse.json({ source: "mock", projectId, projects });
  }
}
