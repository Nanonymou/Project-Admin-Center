import { isMasterLocked, commitMasterVersion } from "@/db/repositories/master-lock-repository";
import type { AuthzResult } from "@/lib/server/rbac";

/**
 * Master Lock guard + automatic versioning (Master Lock & Version Management).
 * These helpers let a master-data write endpoint honor the lock/version model
 * without duplicating the logic: refuse the write when the domain is locked, and
 * record a new version after a committed change so every update is traceable.
 *
 * Both are best-effort against the DB: if the lock/version tables are
 * unreachable the guard allows the write (the domain simply cannot be locked
 * without a DB) and versioning silently no-ops, so the primary write never fails
 * because Master Lock is unavailable.
 */

/** Fail with 409 when the given master domain is locked; allow otherwise. */
export async function assertDomainUnlocked(entityKey: string): Promise<AuthzResult> {
  try {
    if (await isMasterLocked(entityKey)) {
      return { ok: false, status: 409, message: `Master ${entityKey} terkunci — buka kunci sebelum mengubah.` };
    }
  } catch {
    // DB unavailable → cannot be locked; allow the write.
  }
  return { ok: true };
}

/**
 * Bump a master domain's version after a committed change, recording a summary.
 * Best-effort: never throws, so a versioning failure cannot roll back the write
 * that already succeeded.
 */
export async function autoVersionDomain(
  entityKey: string,
  summary: string,
  actor?: string,
): Promise<number | undefined> {
  try {
    return await commitMasterVersion(entityKey, summary, actor);
  } catch {
    return undefined;
  }
}
