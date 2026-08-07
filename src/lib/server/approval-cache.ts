import { revalidateTag, unstable_cache } from "next/cache";
import {
  aggregateApprovalProgressBySite,
  aggregateApprovalStageFunnel,
  listApprovalTimelines,
  type ApprovalFilter,
  type ApprovalTimeline,
  type SiteApprovalProgress,
  type StageFunnelPoint,
} from "@/db/repositories/approval-repository";

/**
 * Cache tag shared by every approval-derived read. Recording an approval
 * transition calls {@link revalidateApprovals} so the next progress/timeline
 * request recomputes — the server side of "update real-time data approval",
 * done via Next's tag-based revalidation instead of client polling.
 */
export const APPROVAL_CACHE_TAG = "approvals";

/** Fallback time-based revalidation (seconds) so caches never go stale forever. */
const APPROVAL_TTL_SECONDS = 30;

function keyOf(prefix: string, filter: ApprovalFilter): string {
  return [prefix, filter.scope ?? "", filter.projectId ?? "", filter.locationId ?? "", filter.subjectType ?? ""].join("|");
}

export function cachedApprovalProgressBySite(filter: ApprovalFilter): Promise<SiteApprovalProgress[]> {
  return unstable_cache(() => aggregateApprovalProgressBySite(filter), [keyOf("appr:prog", filter)], {
    tags: [APPROVAL_CACHE_TAG],
    revalidate: APPROVAL_TTL_SECONDS,
  })();
}

export function cachedApprovalStageFunnel(filter: ApprovalFilter): Promise<StageFunnelPoint[]> {
  return unstable_cache(() => aggregateApprovalStageFunnel(filter), [keyOf("appr:funnel", filter)], {
    tags: [APPROVAL_CACHE_TAG],
    revalidate: APPROVAL_TTL_SECONDS,
  })();
}

export function cachedApprovalTimelines(filter: ApprovalFilter): Promise<ApprovalTimeline[]> {
  return unstable_cache(() => listApprovalTimelines(filter), [keyOf("appr:tl", filter)], {
    tags: [APPROVAL_CACHE_TAG],
    revalidate: APPROVAL_TTL_SECONDS,
  })();
}

/**
 * Invalidate every approval cache entry. Call after any transition so the next
 * read reflects the new stage/status immediately.
 */
export function revalidateApprovals(): void {
  revalidateTag(APPROVAL_CACHE_TAG);
}
