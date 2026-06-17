/** Bony Polymers Pvt Ltd — branding & org defaults */
export const COMPANY = {
  name: "Bony Polymers Pvt Ltd",
  shortName: "Bony Polymers",
  slug: "bony-polymers",
  tagline: "KRA / KPI Master Sheet — Bony Polymers",
  emailDomain: "bonypolymers.com",
  productName: "Bony KPI",
  brandName: "BONY",
  logoPath: "/brand/bony-logo.png",
  logoMarkPath: "/brand/bony-logo-mark.png",
  logoFullPath: "/brand/bony-logo-full.png",
  /** Voice/chat wake name — "Maya, production report" */
  aiAssistantName: "Maya",
  kraMasterSheetLabel: "KRA / KPI Master Sheet",
  plantHeadLabel: "Plant Head",
  orgChartDoc: "BONY-ORG-001 Rev:00",
} as const;

export const KPI_CATEGORIES = [
  "Production",
  "Quality",
  "Sales",
  "Maintenance",
  "Safety",
  "Finance",
  "Process",
  "Store",
  "Billing",
  "HR",
  "IT",
] as const;

export const KRA_PERSPECTIVES = ["Finance", "Quality", "Process"] as const;
