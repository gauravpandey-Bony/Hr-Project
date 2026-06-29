import {
  LayoutDashboard,
  Settings,
  Building2,
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

export const DEPARTMENT_MASTER_PATH = "/dashboard/masters/departments";

export const mainNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Select Unit",
    icon: LayoutDashboard,
    keywords: ["home", "units", "plants", "locations"],
  },
  {
    href: DEPARTMENT_MASTER_PATH,
    label: "Department Master",
    icon: Building2,
    keywords: ["department", "master", "org"],
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
    ? "Master data"
    : item.href === settingsNav.href
      ? "System"
      : "People & HR",
}));
