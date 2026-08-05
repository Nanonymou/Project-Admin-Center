export type ActivityKpi = {
  key: string;
  label: string;
  value: string;
  delta: number;
  deltaLabel: string;
  hint: string;
  tone: "primary" | "success" | "warning" | "danger" | "info";
};

export const ACTIVITY_KPIS: ActivityKpi[] = [
  {
    key: "transactions",
    label: "Transaksi Hari Ini",
    value: "1.284",
    delta: 12.4,
    deltaLabel: "vs kemarin",
    hint: "Sales + Cost aktif",
    tone: "primary",
  },
  {
    key: "sla",
    label: "SLA Compliance",
    value: "94,2%",
    delta: 1.6,
    deltaLabel: "vs minggu lalu",
    hint: "Target 90%",
    tone: "success",
  },
  {
    key: "pending",
    label: "Approval Pending",
    value: "23",
    delta: -8.1,
    deltaLabel: "vs kemarin",
    hint: "Butuh review Leader",
    tone: "warning",
  },
  {
    key: "overdue",
    label: "Invoice Overdue",
    value: "5",
    delta: 2.0,
    deltaLabel: "vs minggu lalu",
    hint: ">14 hari melewati due",
    tone: "danger",
  },
];

export type ActivityFeedItem = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  project: string;
  location: string;
  status: "info" | "success" | "warning" | "danger";
};

export const ACTIVITY_FEED: ActivityFeedItem[] = [
  {
    id: "act-001",
    time: "2 mnt lalu",
    actor: "Site Admin — KM22",
    action: "Submit Daily Closing",
    target: "Closing 04 Ags 2026",
    project: "BUMA",
    location: "KM22",
    status: "info",
  },
  {
    id: "act-002",
    time: "8 mnt lalu",
    actor: "Leader Admin",
    action: "Approve Invoice",
    target: "INV/2026/07/BUMA/0089",
    project: "BUMA",
    location: "KM92",
    status: "success",
  },
  {
    id: "act-003",
    time: "14 mnt lalu",
    actor: "System",
    action: "SLA Warning",
    target: "Tahap Verifikasi Finance H-1",
    project: "PHSS",
    location: "Muara Badak",
    status: "warning",
  },
  {
    id: "act-004",
    time: "22 mnt lalu",
    actor: "Site Admin — Pomala",
    action: "Upload Bukti Pembayaran",
    target: "INV/2026/07/POMALA/0031",
    project: "POMALA",
    location: "Pomala",
    status: "info",
  },
  {
    id: "act-005",
    time: "38 mnt lalu",
    actor: "System",
    action: "Invoice Overdue",
    target: "INV/2026/06/PHKT/0117",
    project: "PHKT",
    location: "Santan",
    status: "danger",
  },
  {
    id: "act-006",
    time: "1 jam lalu",
    actor: "Site Admin — Attaka NIB",
    action: "Input Daily Sales",
    target: "Meals Buffet & Room Service",
    project: "PHKT",
    location: "Attaka NIB",
    status: "info",
  },
  {
    id: "act-007",
    time: "1 jam lalu",
    actor: "Leader Admin",
    action: "Reject Invoice (Perbaikan)",
    target: "INV/2026/07/PHSS/0044",
    project: "PHSS",
    location: "Mutiara",
    status: "warning",
  },
  {
    id: "act-008",
    time: "2 jam lalu",
    actor: "System",
    action: "Auto Lock Period",
    target: "Cut-Off H+1 — 03 Ags 2026",
    project: "BUMA",
    location: "KM22",
    status: "success",
  },
];

export type SiteActivity = {
  project: string;
  location: string;
  transactions: number;
  pending: number;
  slaPct: number;
  status: "healthy" | "watch" | "critical";
};

export const SITE_ACTIVITY: SiteActivity[] = [
  { project: "BUMA", location: "KM22", transactions: 312, pending: 4, slaPct: 96, status: "healthy" },
  { project: "BUMA", location: "KM92", transactions: 287, pending: 6, slaPct: 92, status: "healthy" },
  { project: "POMALA", location: "Pomala", transactions: 198, pending: 3, slaPct: 95, status: "healthy" },
  { project: "PHSS", location: "Muara Badak", transactions: 176, pending: 7, slaPct: 82, status: "watch" },
  { project: "PHSS", location: "Mutiara", transactions: 143, pending: 2, slaPct: 97, status: "healthy" },
  { project: "PHKT", location: "Santan", transactions: 98, pending: 1, slaPct: 74, status: "critical" },
  { project: "PHKT", location: "Attaka NIB", transactions: 70, pending: 0, slaPct: 100, status: "healthy" },
];

export type HourlyPoint = { hour: string; sales: number; cost: number };

export const HOURLY_TREND: HourlyPoint[] = [
  { hour: "06:00", sales: 12, cost: 8 },
  { hour: "07:00", sales: 34, cost: 18 },
  { hour: "08:00", sales: 68, cost: 32 },
  { hour: "09:00", sales: 94, cost: 44 },
  { hour: "10:00", sales: 112, cost: 51 },
  { hour: "11:00", sales: 148, cost: 62 },
  { hour: "12:00", sales: 187, cost: 78 },
  { hour: "13:00", sales: 165, cost: 71 },
  { hour: "14:00", sales: 132, cost: 58 },
  { hour: "15:00", sales: 118, cost: 49 },
  { hour: "16:00", sales: 96, cost: 41 },
  { hour: "17:00", sales: 74, cost: 33 },
  { hour: "18:00", sales: 55, cost: 26 },
];

export type SlaStageBar = {
  stage: string;
  onTime: number;
  atRisk: number;
  overdue: number;
};

export const SLA_STAGE_BARS: SlaStageBar[] = [
  { stage: "Verifikasi Site", onTime: 42, atRisk: 6, overdue: 1 },
  { stage: "Approval Leader", onTime: 34, atRisk: 8, overdue: 2 },
  { stage: "Verifikasi Finance", onTime: 28, atRisk: 5, overdue: 3 },
  { stage: "Kirim ke Client", onTime: 22, atRisk: 3, overdue: 1 },
  { stage: "Payment Received", onTime: 18, atRisk: 4, overdue: 5 },
];
