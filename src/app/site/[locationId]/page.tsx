import { SiteDashboardClient } from "@/components/site/site-dashboard-client";

export default async function SiteDashboardPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  return <SiteDashboardClient locationId={locationId} />;
}
