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
    ],
  },
  {
    label: "Operasional",
    items: [
      { label: "Daily Sales", href: "/daily-sales", icon: ShoppingCart },
      { label: "Daily Cost", href: "/daily-cost", icon: Wallet },
      { label: "Invoice", href: "/invoice", icon: FileText },
      { label: "Gantt Monitoring", href: "/gantt", icon: GanttChartSquare },
    ],
  },
  {
    label: "Master Data",
    items: [
      { label: "Projects", href: "/master/projects", icon: Building2 },
      { label: "Users & Roles", href: "/master/users", icon: Users },
      { label: "Approvals", href: "/master/approvals", icon: BadgeCheck },
      { label: "Configuration", href: "/master/config", icon: Settings2 },
    ],
  },
];
