/**
 * Master Customer & Vendor (config-driven mock). Customers are the mining/energy
 * clients served; vendors are the suppliers behind catering & support services.
 * Frontend-first: the Master Customer/Vendor pages drive this until the
 * customer_vendor table and CRUD API land. Party records are org-level master
 * data (not per-site).
 */

export type PartyType = "customer" | "vendor";
export type PartyStatus = "active" | "inactive";

export type CustomerVendor = {
  id: string;
  code: string;
  name: string;
  type: PartyType;
  /** Category refines the party, e.g. "Tambang Batubara" or "Supplier Bahan Pangan". */
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  /** Indonesian tax id. */
  npwp: string;
  address: string;
  status: PartyStatus;
  createdAt: string; // ISO date
};

export const PARTY_TYPE_META: Record<PartyType, { label: string; variant: "info" | "warning" }> = {
  customer: { label: "Customer", variant: "info" },
  vendor: { label: "Vendor", variant: "warning" },
};

export const PARTY_STATUS_META: Record<PartyStatus, { label: string; variant: "success" | "muted" }> = {
  active: { label: "Aktif", variant: "success" },
  inactive: { label: "Nonaktif", variant: "muted" },
};

const CUSTOMERS: Omit<CustomerVendor, "id" | "type">[] = [
  {
    code: "CUST-BUMA",
    name: "PT Bukit Makmur Mandiri Utama",
    category: "Tambang Batubara",
    contactPerson: "Hendra Gunawan",
    phone: "021-5701234",
    email: "procurement@buma.co.id",
    city: "Jakarta",
    npwp: "01.234.567.8-051.000",
    address: "Jl. TB Simatupang No. 90, Jakarta Selatan",
    status: "active",
    createdAt: "2024-11-02",
  },
  {
    code: "CUST-ANTAM",
    name: "PT Aneka Tambang Tbk",
    category: "Tambang Nikel",
    contactPerson: "Ratna Sari",
    phone: "0405-321100",
    email: "vendor@antam.com",
    city: "Kolaka",
    npwp: "01.001.002.3-806.000",
    address: "Site Pomala, Kolaka, Sulawesi Tenggara",
    status: "active",
    createdAt: "2024-11-10",
  },
  {
    code: "CUST-PHSS",
    name: "Pertamina Hulu Sanga Sanga",
    category: "Minyak & Gas",
    contactPerson: "Bayu Prakoso",
    phone: "0541-770880",
    email: "logistik@phss.pertamina.com",
    city: "Muara Badak",
    npwp: "02.114.556.7-722.000",
    address: "Lapangan Muara Badak, Kutai Kartanegara",
    status: "active",
    createdAt: "2024-12-01",
  },
  {
    code: "CUST-PHKT",
    name: "Pertamina Hulu Kalimantan Timur",
    category: "Minyak & Gas",
    contactPerson: "Sella Marlina",
    phone: "0542-880990",
    email: "support@phkt.pertamina.com",
    city: "Balikpapan",
    npwp: "02.556.778.9-724.000",
    address: "Balikpapan, Kalimantan Timur",
    status: "inactive",
    createdAt: "2025-01-15",
  },
];

const VENDORS: Omit<CustomerVendor, "id" | "type">[] = [
  {
    code: "VND-PANGAN",
    name: "CV Sumber Pangan Sejahtera",
    category: "Supplier Bahan Pangan",
    contactPerson: "Joko Susilo",
    phone: "0812-3456-7890",
    email: "sales@sumberpangan.co.id",
    city: "Samarinda",
    npwp: "31.223.445.6-701.000",
    address: "Jl. Pasar Segiri No. 12, Samarinda",
    status: "active",
    createdAt: "2024-11-20",
  },
  {
    code: "VND-BBM",
    name: "PT Energi Solusi Nusantara",
    category: "Supplier BBM",
    contactPerson: "Arif Wibowo",
    phone: "0541-223344",
    email: "order@energisolusi.co.id",
    city: "Balikpapan",
    npwp: "02.998.776.5-725.000",
    address: "Jl. MT Haryono No. 45, Balikpapan",
    status: "active",
    createdAt: "2024-12-05",
  },
  {
    code: "VND-LAUNDRY",
    name: "CV Bersih Kimia Utama",
    category: "Kimia Laundry",
    contactPerson: "Wati Ningsih",
    phone: "0813-9988-7766",
    email: "cs@bersihkimia.co.id",
    city: "Surabaya",
    npwp: "62.334.556.7-609.000",
    address: "Rungkut Industri, Surabaya",
    status: "active",
    createdAt: "2025-01-08",
  },
  {
    code: "VND-GAS",
    name: "PT Gas Elpiji Andalan",
    category: "Supplier Gas",
    contactPerson: "Rudi Hartanto",
    phone: "0511-556677",
    email: "distribusi@gasandalan.co.id",
    city: "Banjarmasin",
    npwp: "73.445.667.8-731.000",
    address: "Jl. A. Yani KM 6, Banjarmasin",
    status: "inactive",
    createdAt: "2025-02-02",
  },
];

const ALL: CustomerVendor[] = [
  ...CUSTOMERS.map((c, i) => ({ ...c, id: `party-cust-${i}`, type: "customer" as PartyType })),
  ...VENDORS.map((v, i) => ({ ...v, id: `party-vnd-${i}`, type: "vendor" as PartyType })),
];

export function listCustomerVendors(): CustomerVendor[] {
  return ALL;
}

export function getCustomerVendor(id: string): CustomerVendor | undefined {
  return ALL.find((p) => p.id === id);
}
