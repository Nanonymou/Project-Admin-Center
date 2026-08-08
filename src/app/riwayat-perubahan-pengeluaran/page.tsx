import { CostChangeHistory } from "@/components/riwayat-perubahan-pengeluaran/cost-change-history";

export default async function RiwayatPerubahanPengeluaranPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location } = await searchParams;
  return <CostChangeHistory initialLocationId={location} />;
}
