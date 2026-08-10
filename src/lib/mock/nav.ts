import {
  LayoutDashboard,
  Activity,
  ShoppingCart,
  Wallet,
  FileText,
  GanttChartSquare,
  Settings2,
  Users,
  Building2,
  BadgeCheck,
  Trophy,
  CalendarDays,
  PiggyBank,
  Calculator,
  CopyPlus,
  Copy,
  History,
  FileSpreadsheet,
  Download,
  Lock,
  LockOpen,
  GitBranch,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { label: "Executive Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Activity Dashboard", href: "/activity", icon: Activity, badge: "Live" },
      { label: "Ranking Site", href: "/ranking", icon: Trophy },
      { label: "Dashboard Leader", href: "/leader", icon: BadgeCheck },
      { label: "Dashboard Margin", href: "/margin", icon: PiggyBank },
      { label: "Site Performance", href: "/performance", icon: Trophy },
      { label: "Peringkat Project", href: "/project-performance", icon: Trophy },
      { label: "Perbandingan Sales", href: "/sales-compare", icon: ShoppingCart },
      { label: "Perbandingan Cost", href: "/cost-compare", icon: Wallet },
    ],
  },
  {
    label: "Operasional",
    items: [
      { label: "Daily Sales", href: "/daily-sales", icon: ShoppingCart },
      { label: "Daily Cost", href: "/daily-cost", icon: Wallet },
      { label: "Daily Closing", href: "/daily-closing", icon: BadgeCheck },
      { label: "Invoice", href: "/invoice", icon: FileText },
      { label: "Outstanding Invoice", href: "/outstanding", icon: FileText },
      { label: "Invoice Aging", href: "/aging", icon: FileText },
      { label: "Approval Progress", href: "/approvals", icon: BadgeCheck },
      { label: "SLA Approval", href: "/sla", icon: BadgeCheck },
      { label: "Kalender Deadline", href: "/calendar", icon: CalendarDays },
      { label: "Cut-Off & Pengiriman", href: "/cutoff", icon: CalendarDays },
      { label: "Compliance Monitoring", href: "/compliance", icon: BadgeCheck },
      { label: "Timeline Approval", href: "/timeline", icon: GanttChartSquare },
      { label: "Attachment Center", href: "/attachment-center", icon: FileText },
      { label: "Total Otomatis", href: "/total-otomatis", icon: Calculator },
      { label: "Salin Data Kemarin", href: "/salin-data-kemarin", icon: CopyPlus },
      { label: "Riwayat Perubahan Pengeluaran", href: "/riwayat-perubahan-pengeluaran", icon: History },
      { label: "Duplikat Record", href: "/duplikat-record", icon: Copy },
      { label: "Impor Excel", href: "/impor-excel", icon: FileSpreadsheet },
      { label: "Submit Daily Cost", href: "/submit-daily-cost", icon: Wallet },
      { label: "Ekspor Excel", href: "/ekspor-excel", icon: Download },
      { label: "Daily Cost Dana Cash", href: "/daily-cost-dana-cash", icon: PiggyBank },
      { label: "Persetujuan Daily Sales", href: "/persetujuan-daily-sales", icon: BadgeCheck },
      { label: "Riwayat Perubahan Penjualan", href: "/riwayat-perubahan-penjualan", icon: History },
      { label: "Formula Engine Invoice", href: "/formula-engine-invoice", icon: Calculator },
      { label: "Detail Invoice", href: "/detail-invoice", icon: FileText },
      { label: "Pratinjau Lampiran", href: "/pratinjau-lampiran", icon: FileText },
      { label: "Audit Trail Invoice", href: "/audit-trail-invoice", icon: History },
      { label: "Invoice Processing Timeline", href: "/invoice-processing-timeline", icon: GanttChartSquare },
    ],
  },
  {
    label: "Master Data",
    items: [
      { label: "Projects", href: "/master/projects", icon: Building2 },
      { label: "Users & Roles", href: "/master/users", icon: Users },
      { label: "User & Storage", href: "/user-monitoring", icon: Users },
      { label: "Approvals", href: "/master/approvals", icon: BadgeCheck },
      { label: "Manajemen Periode", href: "/period-status", icon: CalendarDays },
      { label: "Kebijakan Cut-Off", href: "/cutoff-policy", icon: CalendarDays },
      { label: "Lock Period", href: "/lock-period", icon: Settings2 },
      { label: "Kunci Periode", href: "/kunci-periode", icon: Lock },
      { label: "Unlock Period", href: "/unlock-period", icon: LockOpen },
      { label: "Configuration", href: "/master/config", icon: Settings2 },
      { label: "Workflow Default Approval", href: "/workflow-default-approval", icon: GitBranch },
      { label: "Master Timeframe", href: "/upload-timeframe", icon: CalendarClock },
      { label: "Backup & Restore", href: "/backup", icon: Settings2 },
      { label: "Recycle Bin", href: "/recycle-bin", icon: Settings2 },
      { label: "Import/Export", href: "/import-export", icon: Settings2 },
    ],
  },
];
