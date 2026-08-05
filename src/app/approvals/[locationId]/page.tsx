import { ApprovalTimelineClient } from "@/components/approvals/approval-timeline-client";

export default async function ApprovalTimelinePage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  return <ApprovalTimelineClient locationId={locationId} />;
}
