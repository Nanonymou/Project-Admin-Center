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
      { label: "Perbandingan Sales", href: "/sales-compare", icon: ShoppingCart },
      { label: "Perbandingan Cost", href: "/cost-compare", icon: Wallet },
    ],
  },
  {
    label: "Operasional",
    items: [
      { label: "Daily Sales", href: "/daily-sales", icon: ShoppingCart },
      { label: "Daily Cost", href: "/daily-cost", icon: Wallet },
      { label: "Invoice", href: "/invoice", icon: FileText },
      { label: "Outstanding Invoice", href: "/outstanding", icon: FileText },
      { label: "Approval Progress", href: "/approvals", icon: BadgeCheck },
      { label: "Kalender Deadline", href: "/calendar", icon: CalendarDays },
      { label: "Cut-Off & Pengiriman", href: "/cutoff", icon: CalendarDays },
      { label: "Timeline Approval", href: "/timeline", icon: GanttChartSquare },
    ],
  },
  {
    label: "Master Data",
    items: [
      { label: "Projects", href: "/master/projects", icon: Building2 },
      { label: "Users & Roles", href: "/master/users", icon: Users },
      { label: "Approvals", href: "/master/approvals", icon: BadgeCheck },
      { label: "Manajemen Periode", href: "/period-status", icon: CalendarDays },
      { label: "Kebijakan Cut-Off", href: "/cutoff-policy", icon: CalendarDays },
      { label: "Lock Period", href: "/lock-period", icon: Settings2 },
      { label: "Configuration", href: "/master/config", icon: Settings2 },
    ],
  },
];
