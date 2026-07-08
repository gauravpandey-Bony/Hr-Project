import {
  LayoutDashboard,
  Target,
  PenLine,
  BarChart3,
  Settings,
  Sparkles,
  FileSpreadsheet,
  Building2,
  Users,
  MessageSquare,
  Flag,
  LineChart,
  Wallet,
  Scale,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  keywords?: string[];
};

export const mainNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Select Unit",
    icon: LayoutDashboard,
    keywords: ["home", "units", "plants", "locations"],
  },
  {
    href: "/dashboard/units/bony-37p",
    label: "KPI Dashboard",
    icon: BarChart3,
    keywords: ["overview", "metrics", "37p", "dashboard"],
  },
  {
    href: "/dashboard/kpis",
    label: "KPI Library",
    icon: Target,
    keywords: ["metrics", "list", "library"],
  },
  {
    href: "/dashboard/ai",
    label: "Maya AI",
    icon: Sparkles,
    keywords: ["chat", "assistant", "copilot", "maya", "voice"],
  },
  {
    href: "/dashboard/track",
    label: "Update Data",
    icon: PenLine,
    keywords: ["entry", "log", "update"],
  },
  {
    href: "/dashboard/kra",
    label: "KRA / KPI Master Sheet",
    icon: FileSpreadsheet,
    keywords: ["sheet", "kra", "spreadsheet"],
  },
  {
    href: "/dashboard/masters/departments",
    label: "Department Master",
    icon: Building2,
    keywords: ["department", "master", "org"],
  },
  {
    href: "/dashboard/masters/employees",
    label: "Employee Master",
    icon: Users,
    keywords: ["employee", "master", "staff"],
  },
  {
    href: "/dashboard/masters/employees/all",
    label: "All Employees",
    icon: Users,
    keywords: ["employee", "all", "plants", "global", "master"],
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    keywords: ["analytics", "league", "ranking"],
  },
];

export const hrNav: NavItem[] = [
  {
    href: "/dashboard/reviews",
    label: "Reviews",
    keywords: ["performance", "cycle"],
  },
  {
    href: "/dashboard/feedback",
    label: "360° Feedback",
    icon: MessageSquare,
    keywords: ["360", "peer"],
  },
  {
    href: "/dashboard/goals",
    label: "Goals",
    icon: Flag,
    keywords: ["okr", "objectives"],
  },
  {
    href: "/dashboard/surveys",
    label: "Surveys",
    keywords: ["pulse", "engagement"],
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: LineChart,
    keywords: ["insights", "charts"],
  },
  {
    href: "/dashboard/calibration",
    label: "Calibration",
    icon: Scale,
    keywords: ["nine box", "talent"],
  },
  {
    href: "/dashboard/compensation",
    label: "Compensation",
    icon: Wallet,
    keywords: ["pay", "salary"],
  },
];

export const settingsNav: NavItem = {
  href: "/dashboard/settings",
  label: "Settings",
  icon: Settings,
  keywords: ["preferences", "hris", "integrations"],
};

export const allNavItems: NavItem[] = [
  ...mainNav,
  ...hrNav,
  settingsNav,
];

export const commandPaletteItems = allNavItems.map((item) => ({
  ...item,
  group: mainNav.some((m) => m.href === item.href)
    ? "KPI tracking"
    : item.href === settingsNav.href
      ? "System"
      : "People & HR",
}));
