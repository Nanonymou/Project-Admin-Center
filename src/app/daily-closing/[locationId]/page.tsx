import { DailyClosingDetailClient } from "@/components/daily-closing/daily-closing-detail-client";

export default async function DailyClosingDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  return <DailyClosingDetailClient locationId={locationId} />;
}
