import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessLocation } from "@/lib/personas";
import { MOCK_WORKSPACES } from "@/lib/mock/workspaces";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";

export const dynamic = "force-dynamic";

/**
 * GET /api/hak-akses/workspace-switch — the workspaces the calling persona may
 * switch between (their in-scope sites). A Leader/Super Admin sees their whole
 * portfolio; a Site Admin sees only their own site(s). `canSwitch` reflects the
 * persona's switch-workspace capability so the UI can enable/disable the picker.
 */
export async function GET(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  const workspaces = MOCK_WORKSPACES.filter((w) =>
    canAccessLocation(persona, w.locationId, w.projectCode),
  ).map((w) => ({
    projectCode: w.projectCode,
    projectName: w.projectName,
    locationId: w.locationId,
    locationName: w.locationName,
    invoicePeriod: w.invoicePeriod,
  }));

  return NextResponse.json({
    role: persona.role,
    canSwitch: persona.capabilities.canSwitchWorkspace,
    count: workspaces.length,
    workspaces,
  });
}

/**
 * POST /api/hak-akses/workspace-switch — switch the active workspace for a leader.
 * Body: { locationId }.
 *
 * Validates that the persona is allowed to switch workspaces and that the target
 * site is within their scope, then returns the resolved workspace context the
 * client should adopt. The active workspace itself lives in client/session state
 * (frontend-first), so this endpoint authorizes and resolves rather than persists.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;

  if (!persona.capabilities.canSwitchWorkspace) {
    return NextResponse.json(
      { error: "Role Anda tidak dapat berpindah workspace." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const locationId = typeof body.locationId === "string" ? body.locationId : "";
  if (!locationId) return NextResponse.json({ error: "locationId wajib diisi." }, { status: 400 });

  const target = MOCK_WORKSPACES.find((w) => w.locationId === locationId);
  if (!target) return NextResponse.json({ error: "Workspace tidak dikenal." }, { status: 404 });
  if (!canAccessLocation(persona, target.locationId, target.projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke lokasi ${locationId}.` }, { status: 403 });
  }

  // Best-effort audit — the switch itself is client state, so a DB outage does
  // not block it.
  try {
    await writeAuditLog({
      projectId: target.projectCode,
      locationId: target.locationId,
      category: "access",
      action: "workspace.switch",
      actor: persona.name,
      entityType: "workspace",
      entityId: target.locationId,
      detail: `Pindah workspace ke ${target.projectName} — ${target.locationName}.`,
    });
  } catch {
    // ignore — audit is best-effort
  }

  return NextResponse.json({
    ok: true,
    workspace: {
      projectId: target.projectId,
      projectCode: target.projectCode,
      projectName: target.projectName,
      locationId: target.locationId,
      locationName: target.locationName,
      invoicePeriod: target.invoicePeriod,
    },
  });
}
