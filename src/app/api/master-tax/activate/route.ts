import { NextResponse, type NextRequest } from "next/server";
import { requirePersona } from "@/lib/server/rbac";
import { canAccessProject } from "@/lib/personas";
import { getMasterTax, upsertMasterTax } from "@/db/repositories/master-tax-repository";
import { writeAuditLog } from "@/db/repositories/audit-log-repository";
import { assertDomainUnlocked, autoVersionDomain } from "@/lib/server/services/master-lock-guard";
import { getTaxConfig } from "@/lib/mock/tax-config";

export const dynamic = "force-dynamic";

/**
 * POST /api/master-tax/activate — activate the tax profile for a project.
 * Body: { projectCode, code?, label?, rate? }.
 *
 * Ensures the project has an ACTIVE tax profile: if one already exists it is
 * activated (and optionally updated with any supplied code/label/rate); if none
 * exists it is seeded from the config tax matrix for that project, then
 * activated. This is how a project opts into a tax without hand-crafting the row.
 * Blocked while the tax master is locked; bumps the tax domain version.
 * Leader/Super Admin, project-scoped.
 */
export async function POST(req: NextRequest) {
  const auth = requirePersona(req.headers);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const persona = auth.persona;
  if (!persona.capabilities.canConfigure) {
    return NextResponse.json({ error: "Hanya Leader/Super Admin yang dapat mengaktifkan pajak." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const projectCode = typeof body.projectCode === "string" ? body.projectCode.trim() : "";
  if (!projectCode) return NextResponse.json({ error: "projectCode wajib diisi." }, { status: 400 });
  if (!canAccessProject(persona, projectCode)) {
    return NextResponse.json({ error: `Tidak ada akses ke project ${projectCode}.` }, { status: 403 });
  }

  const taxLock = await assertDomainUnlocked("tax");
  if (!taxLock.ok) return NextResponse.json({ error: taxLock.message }, { status: taxLock.status });

  // Resolve the profile to activate: any explicit overrides, else the existing
  // row's values, else the config tax matrix for this project.
  const cfg = getTaxConfig(projectCode);
  const overrideRate = body.rate !== undefined ? Number(body.rate) : undefined;
  const rateFraction =
    overrideRate === undefined || Number.isNaN(overrideRate)
      ? undefined
      : overrideRate > 1
        ? overrideRate / 100
        : overrideRate;

  try {
    const existing = await getMasterTax(projectCode);
    const code = (typeof body.code === "string" && body.code.trim()) || existing?.code || cfg.code;
    const label = (typeof body.label === "string" && body.label.trim()) || existing?.label || cfg.label;
    const rate = rateFraction ?? (existing ? Number(existing.rate) : cfg.rate);

    await upsertMasterTax({
      projectCode,
      code,
      label,
      rate: rate.toFixed(4),
      active: true,
      createdBy: persona.name,
    });
    await writeAuditLog({
      projectId: projectCode,
      category: "master",
      action: "tax.activate_project",
      actor: persona.name,
      entityType: "master_tax",
      entityId: projectCode,
      detail: `Aktifkan pajak ${label} (${(rate * 100).toFixed(1)}%) untuk ${projectCode}.`,
    });
    await autoVersionDomain("tax", `Aktifkan pajak ${projectCode} → ${label}`, persona.name);
    return NextResponse.json({ ok: true, projectCode, tax: { code, label, rate, active: true } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal mengaktifkan pajak (database tidak tersedia)." }, { status: 503 });
  }
}
