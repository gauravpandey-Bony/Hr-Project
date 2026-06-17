import type { PlantKpiDef } from "@/lib/plant-37p";

type Q = PlantKpiDef["quarterTargets"];

function qt(
  q1: { t: string; a?: string },
  q2: { t: string; a?: string },
  q3: { t: string; a?: string },
  q4: { t: string; a?: string }
): Q {
  const s = (v?: string | number) => (v === undefined || v === "" ? "" : String(v));
  return {
    q1: { target: q1.t, achieved: s(q1.a) },
    q2: { target: q2.t, achieved: s(q2.a) },
    q3: { target: q3.t, achieved: s(q3.a) },
    q4: { target: q4.t, achieved: s(q4.a) },
  };
}

/** IT & Systems — Bhupesh Sharma sheet (New KRA KPI 13-4-26.xlsx), department level, no names */
export const IT_KPIS: PlantKpiDef[] = [
  {
    id: "it-budget-cost-saving",
    kraName: "Budgeting",
    name: "Cost saving of IT Equipments",
    category: "Finance",
    perspective: "Finance",
    unit: "%",
    weightage: 0.08,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "0.25", a: "7.5" },
      { t: "0.25", a: "8" },
      { t: "0.25", a: "8" },
      { t: "0.25", a: "8" }
    ),
    values: [75, 80, 80, 80],
  },
  {
    id: "it-cyber-security",
    kraName: "Cyber Security",
    name: "Securing Infrastructure",
    category: "Process",
    perspective: "Security",
    unit: "%",
    weightage: 0.08,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "0.25", a: "7.5" },
      { t: "0.25", a: "7.5" },
      { t: "0.25", a: "8" },
      { t: "0.25", a: "8" }
    ),
    values: [75, 75, 80, 80],
  },
  {
    id: "it-ai-programs",
    kraName: "AI Programs/ Project",
    name: "Developer AI programs In House",
    category: "Process",
    perspective: "Security",
    unit: "%",
    weightage: 0.1,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "0.25", a: "10" },
      { t: "0.25", a: "10" },
      { t: "0.25", a: "10" },
      { t: "0.25", a: "10" }
    ),
    values: [100, 100, 100, 100],
  },
  {
    id: "it-user-request-minor",
    kraName: "Users & Customer Satisfaction",
    name: "Timely closure of User service request (Minor)",
    category: "Process",
    perspective: "Users",
    unit: "Hours",
    weightage: 0.1,
    targetValue: 24,
    direction: "LOWER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "<= 24Hrs", a: "9.5" },
      { t: "<= 24Hrs", a: "9.5" },
      { t: "<= 24Hrs", a: "9.5" },
      { t: "<= 24Hrs", a: "9.5" }
    ),
    values: [22, 23, 23, 24],
  },
  {
    id: "it-user-request-major",
    kraName: "Users & Customer Satisfaction",
    name: "Average Timely closure of User service request (Major)",
    category: "Process",
    perspective: "Users",
    unit: "Days",
    weightage: 0.09,
    targetValue: 5,
    direction: "LOWER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "<= 5 Working Days", a: "9" },
      { t: "<= 5 Working Days", a: "9" },
      { t: "<= 5 Working Days", a: "9" },
      { t: "<= 5 Working Days", a: "9" }
    ),
    values: [4, 5, 5, 5],
  },
  {
    id: "it-customer-audits",
    kraName: "Users & Customer Satisfaction",
    name: "Customer Audits",
    category: "Quality",
    perspective: "Users",
    unit: "%",
    weightage: 0.05,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "1", a: "5" },
      { t: "1", a: "5" },
      { t: "1", a: "5" },
      { t: "1", a: "5" }
    ),
    values: [100, 100, 100, 100],
  },
  {
    id: "it-skill-up-pms",
    kraName: "Skill Up & PMS",
    name: "Engaging for people development, nomination of team for training and development",
    category: "HR",
    perspective: "People",
    unit: "%",
    weightage: 0.03,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      {
        t: "1. As per competency list\n2. Nomination >80%",
        a: "3",
      },
      {
        t: "1. As per competency list\n2. Nomination >80%",
        a: "3",
      },
      {
        t: "1. As per competency list\n2. Nomination >80%",
        a: "3",
      },
      {
        t: "1. As per competency list\n2. Nomination >80%",
        a: "3",
      }
    ),
    values: [80, 85, 90, 90],
  },
  {
    id: "it-hardware-calls",
    kraName: "Hardware - Installation, Configuration & Troubleshooting",
    name: "Call Management for hardware complaints",
    category: "Maintenance",
    perspective: "Process",
    unit: "Hrs/Days",
    weightage: 0.04,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      {
        t: "1. Assigning of calls to team: <1 hours\n2. Resolution: <24 Hrs.",
        a: "3",
      },
      {
        t: "1. Assigning of calls to team: <1 hours\n2. Resolution: <24 Hrs.",
        a: "3.5",
      },
      {
        t: "1. Assigning of calls to team: <1 hours\n2. Resolution: <24 Hrs.",
        a: "3.5",
      },
      {
        t: "1. Assigning of calls to team: <1 hours\n2. Resolution: <24 Hrs.",
        a: "3.5",
      }
    ),
    values: [90, 92, 94, 95],
  },
  {
    id: "it-network-availability",
    kraName: "Network Administration",
    name: "Seamless interconnectivity between systems through switches, LAN and firewalls",
    category: "Process",
    perspective: "Process",
    unit: "% availability",
    weightage: 0.05,
    targetValue: 90,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: ">90%", a: "5" },
      { t: ">90%", a: "5" },
      { t: ">90%", a: "5" },
      { t: ">90%", a: "5" }
    ),
    values: [92, 93, 94, 95],
  },
  {
    id: "it-cloud-backup",
    kraName: "Cloud Management",
    name: "Backup, Storage and Working on Cloud",
    category: "Process",
    perspective: "Process",
    unit: "Daily",
    weightage: 0.05,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "1", a: "5" },
      { t: "1", a: "5" },
      { t: "1", a: "5" },
      { t: "1", a: "5" }
    ),
    values: [100, 100, 100, 100],
  },
  {
    id: "it-vpn-services",
    kraName: "Cloud Management",
    name: "Maintenance of VPN Services",
    category: "Process",
    perspective: "Process",
    unit: "As per Need",
    weightage: 0.05,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "1", a: "5" },
      { t: "1", a: "5" },
      { t: "1", a: "5" },
      { t: "1", a: "5" }
    ),
    values: [100, 100, 100, 100],
  },
  {
    id: "it-sap-training",
    kraName: "SAP Implementation",
    name: "Training on SAP for users",
    category: "Process",
    perspective: "Process",
    unit: "%",
    weightage: 0.05,
    targetValue: 90,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: ">90% coverage of users", a: "5" },
      { t: ">90%", a: "5" },
      { t: ">90%", a: "5" },
      { t: ">90%", a: "5" }
    ),
    values: [88, 90, 92, 93],
  },
  {
    id: "it-sap-query-handling",
    kraName: "SAP Implementation",
    name: "Timely Query and Issue - Handling & Management (Based on Third Party)",
    category: "Process",
    perspective: "Process",
    unit: "Hours/Days",
    weightage: 0.2,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      {
        t: "1. <6 Working hours (minor)\n2. < 15 Working days (major)",
        a: "19.5",
      },
      {
        t: "1. <6 Working hours (minor)\n2. < 15 Working days (major)",
        a: "19.5",
      },
      {
        t: "1. <6 Working hours (minor)\n2. < 15 Working days (major)",
        a: "19.5",
      },
      {
        t: "1. <6 Working hours (minor)\n2. < 15 Working days (major)",
        a: "19.5",
      }
    ),
    values: [85, 88, 90, 92],
  },
  {
    id: "it-cctv-monitoring",
    kraName: "Hardware - Installation, Configuration & Troubleshooting",
    name: "CCTV - Monitoring",
    category: "Safety",
    perspective: "Process",
    unit: "% availability",
    weightage: 0.03,
    targetValue: 100,
    direction: "HIGHER_IS_BETTER",
    department: "IT",
    kpiLevel: "DEPARTMENT",
    quarterTargets: qt(
      { t: "1", a: "3" },
      { t: "1", a: "3" },
      { t: "1", a: "3" },
      { t: "1", a: "3" }
    ),
    values: [100, 100, 100, 100],
  },
];
