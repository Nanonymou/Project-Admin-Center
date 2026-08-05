import { InvoiceDetailClient } from "@/components/invoice/invoice-detail-client";
import { slugToInvoiceNumber } from "@/lib/mock/invoice-lookup";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <InvoiceDetailClient invoiceNumber={slugToInvoiceNumber(slug)} />;
}
