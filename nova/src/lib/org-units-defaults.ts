/** Default seed data — imported into DB on first sync; reconciled on load. */

export const BONY_37P_LOCATION_ALIASES = [
  "Bony 37P",
  "BONY 37P",
  "Bony Polymers 37-P",
  "Bony Polymers",
  "Plant Corp. 37P",
  "Plant  Cop.",
] as const;

export const BONY_37P_KPI_PLANT_ALIASES = ["37P", "Bony Polymers", "Bony 37P"] as const;

export type DefaultOrgUnit = {
  slug: string;
  name: string;
  subtitle?: string;
  plantUnitKey: string;
  locationAliases?: readonly string[];
  kpiPlantAliases?: readonly string[];
  gradientCss: string;
  accent: string;
  emoji: string;
  sortOrder: number;
};

export type DefaultOrgGroup = {
  slug: string;
  name: string;
  subtitle?: string;
  gradientCss: string;
  accent: string;
  emoji: string;
  sortOrder: number;
  units: DefaultOrgUnit[];
};

export const DEFAULT_ORG_GROUPS: DefaultOrgGroup[] = [
  {
    slug: "bony",
    name: "Bony",
    subtitle: "8 plant locations · all live",
    gradientCss: "linear-gradient(135deg, #059669 0%, #10b981 50%, #14b8a6 100%)",
    accent: "text-emerald-600",
    emoji: "🏭",
    sortOrder: 0,
    units: [
      {
        slug: "bony-37p",
        name: "Bony 37P",
        subtitle: "KPI workspace",
        plantUnitKey: "Bony Polymers",
        locationAliases: [
          ...BONY_37P_LOCATION_ALIASES,
          "Plot No.- 37 P, Sector- 6, Faridabad",
        ],
        kpiPlantAliases: BONY_37P_KPI_PLANT_ALIASES,
        gradientCss: "linear-gradient(135deg, #059669 0%, #10b981 50%, #14b8a6 100%)",
        accent: "text-emerald-600",
        emoji: "📊",
        sortOrder: 0,
      },
      {
        slug: "bony-corporate",
        name: "Bony Corporate",
        subtitle: "Corporate office · Faridabad",
        plantUnitKey: "Bony Corporate",
        locationAliases: [
          "Bony Corporate",
          "Bony Corporate Faridabad",
          "BONY POLYMERS PVT. LTD. PLANT- CORPORATE FARIDABAD",
        ],
        kpiPlantAliases: ["Bony Corporate"],
        gradientCss: "linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%)",
        accent: "text-emerald-700",
        emoji: "🏢",
        sortOrder: 1,
      },
      {
        slug: "bony-77",
        name: "Bony 77",
        subtitle: "Live · add KPI data",
        plantUnitKey: "Bony 77",
        locationAliases: [
          "Bony 77",
          "Bony 77 Faridabad",
          "BONY POLYMERS PVT LTD. PLOT No.-77, Sector- 6, Faridabad",
        ],
        kpiPlantAliases: ["Bony 77"],
        gradientCss: "linear-gradient(135deg, #0d9488 0%, #10b981 50%, #22c55e 100%)",
        accent: "text-teal-600",
        emoji: "🏭",
        sortOrder: 2,
      },
      {
        slug: "bony-24",
        name: "Bony 24",
        subtitle: "Live · add KPI data",
        plantUnitKey: "Bony 24",
        locationAliases: [
          "Bony 24",
          "Bony 24 Faridabad",
          "Plot No.- 132, Sector- 24, Faridabad",
        ],
        kpiPlantAliases: ["Bony 24"],
        gradientCss: "linear-gradient(135deg, #16a34a 0%, #10b981 50%, #14b8a6 100%)",
        accent: "text-green-600",
        emoji: "🏭",
        sortOrder: 3,
      },
      {
        slug: "bony-maneshar",
        name: "Bony Maneshar",
        subtitle: "Live · add KPI data",
        plantUnitKey: "Bony Maneshar",
        gradientCss: "linear-gradient(135deg, #047857 0%, #0d9488 50%, #10b981 100%)",
        accent: "text-emerald-700",
        emoji: "🏭",
        sortOrder: 4,
      },
      {
        slug: "bony-gujrat",
        name: "Bony Gujrat",
        subtitle: "Live · add KPI data",
        plantUnitKey: "Bony Gujrat",
        locationAliases: ["Bony Gujrat", "Viramgam, Gujarat"],
        kpiPlantAliases: ["Bony Gujrat"],
        gradientCss: "linear-gradient(135deg, #0891b2 0%, #14b8a6 50%, #10b981 100%)",
        accent: "text-cyan-600",
        emoji: "🏭",
        sortOrder: 5,
      },
      {
        slug: "bony-pune",
        name: "Bony Pune",
        subtitle: "Live · add KPI data",
        plantUnitKey: "Bony Pune",
        locationAliases: ["Bony Pune", "Pune"],
        kpiPlantAliases: ["Bony Pune"],
        gradientCss: "linear-gradient(135deg, #65a30d 0%, #22c55e 50%, #10b981 100%)",
        accent: "text-lime-700",
        emoji: "🏭",
        sortOrder: 6,
      },
      {
        slug: "bony-haridwar-1",
        name: "Bony Haridwar 1",
        subtitle: "Live · add KPI data",
        plantUnitKey: "Bony Haridwar 1",
        locationAliases: [
          "Bony Haridwar 1",
          "Plot no. 6, Industrial Park- 4, Haridwar",
        ],
        kpiPlantAliases: ["Bony Haridwar 1"],
        gradientCss: "linear-gradient(135deg, #059669 0%, #22c55e 50%, #14b8a6 100%)",
        accent: "text-emerald-600",
        emoji: "🏭",
        sortOrder: 7,
      },
      {
        slug: "bony-haridwar-2",
        name: "Bony Haridwar 2",
        subtitle: "Live · add KPI data",
        plantUnitKey: "Bony Haridwar 2",
        gradientCss: "linear-gradient(135deg, #0f766e 0%, #059669 50%, #22c55e 100%)",
        accent: "text-teal-700",
        emoji: "🏭",
        sortOrder: 7,
      },
    ],
  },
  {
    slug: "saket-fabs",
    name: "Saket Fabs",
    subtitle: "4 units · all live",
    gradientCss: "linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #d946ef 100%)",
    accent: "text-violet-600",
    emoji: "⚙️",
    sortOrder: 1,
    units: [
      {
        slug: "saket-sheet-metal",
        name: "Saket Fabs Sheet Metal",
        subtitle: "Unit 1 · Live · add KPI data",
        plantUnitKey: "Saket Fabs Sheet Metal",
        locationAliases: [
          "Saket Fabs Sheet Metal",
          "Saket Fabs",
          "SF-1",
          "SF1",
          "Plant SF1",
          "Saket Fabs - Unit 1",
          "Saket Fabs Prithla",
          "SAKET FABS PVT. LTD.- PRITHLA",
          "Saket Fabs Ajronda",
          "SAKET FABS PVT. LTD.- AJRONDA CHOWK",
        ],
        kpiPlantAliases: ["Saket Fabs Sheet Metal", "SF-1", "Saket Fabs"],
        gradientCss: "linear-gradient(135deg, #8b5cf6 0%, #a855f7 50%, #7c3aed 100%)",
        accent: "text-violet-600",
        emoji: "🔩",
        sortOrder: 0,
      },
      {
        slug: "saket-coating",
        name: "Saket Fabs Coating",
        subtitle: "Unit 2 · Live · add KPI data",
        plantUnitKey: "Saket Fabs Coating",
        gradientCss: "linear-gradient(135deg, #a855f7 0%, #d946ef 50%, #7c3aed 100%)",
        accent: "text-purple-600",
        emoji: "🎨",
        sortOrder: 1,
      },
      {
        slug: "saket-haridwar",
        name: "Saket Fabs Haridwar",
        subtitle: "Unit 3 · Live · add KPI data",
        plantUnitKey: "Saket Fabs Haridwar",
        gradientCss: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #9333ea 100%)",
        accent: "text-indigo-600",
        emoji: "🏭",
        sortOrder: 2,
      },
      {
        slug: "saket-gujrat",
        name: "Saket Fabs Gujrat",
        subtitle: "Unit 4 · Live · add KPI data",
        plantUnitKey: "Saket Fabs Gujrat",
        gradientCss: "linear-gradient(135deg, #d946ef 0%, #a855f7 50%, #7c3aed 100%)",
        accent: "text-fuchsia-600",
        emoji: "🏭",
        sortOrder: 3,
      },
    ],
  },
];

/** Slugs from an old incorrect seed — deactivated on reconcile */
export const OBSOLETE_UNIT_SLUGS = [
  "bony-38p",
  "bony-39p",
  "bony-40p",
  "bony-41p",
  "bony-42p",
  "bony-43p",
  "bony-44p",
  "saket-unit-1",
  "saket-unit-2",
  "saket-unit-3",
  "saket-unit-4",
  "neon",
] as const;

/** Old slugs → merged/replaced unit (bookmarks & saved admin unit) */
export const OBSOLETE_UNIT_REDIRECTS: Record<string, string> = {
  neon: "rc-auto",
};

export const DEFAULT_STANDALONE_UNITS: DefaultOrgUnit[] = [
  {
    slug: "bony-fluid-58",
    name: "Bony Fluid 58",
    subtitle: "Live · add KPI data",
    plantUnitKey: "Bony Fluid 58",
    locationAliases: ["Bony Fluid 58", "Plant 58", "BF 58", "BONY FLUID SYSTEMS PVT. LTD."],
    kpiPlantAliases: ["Bony Fluid 58", "Plant 58"],
    gradientCss: "linear-gradient(135deg, #0891b2 0%, #14b8a6 50%, #10b981 100%)",
    accent: "text-cyan-600",
    emoji: "💧",
    sortOrder: 0,
  },
  {
    slug: "prime-india",
    name: "Prime India",
    subtitle: "Live · add KPI data",
    plantUnitKey: "Prime India",
    locationAliases: [
      "Prime India",
      "Prime India Polymix Private Limited",
    ],
    gradientCss: "linear-gradient(135deg, #2563eb 0%, #6366f1 50%, #2563eb 100%)",
    accent: "text-blue-600",
    emoji: "🇮🇳",
    sortOrder: 1,
  },
  {
    slug: "inensy-electronics",
    name: "Inensy Electronics",
    subtitle: "Live · add KPI data",
    plantUnitKey: "Inensy Electronics",
    gradientCss: "linear-gradient(135deg, #d97706 0%, #f97316 50%, #d97706 100%)",
    accent: "text-amber-600",
    emoji: "⚡",
    sortOrder: 2,
  },
  {
    slug: "rc-auto",
    name: "Arshee Auto / Neon",
    subtitle: "Live · add KPI data",
    plantUnitKey: "Arshee Auto",
    locationAliases: [
      "Arshee Auto",
      "Arshee Auto Faridabad",
      "ARSHEE AUTO PVT. LTD, Plot No.- 9E, Sector- 6, Faridabad",
      "RC Auto",
      "Neon",
    ],
    kpiPlantAliases: ["Arshee Auto", "RC Auto", "Neon"],
    gradientCss: "linear-gradient(135deg, #e11d48 0%, #d946ef 50%, #db2777 100%)",
    accent: "text-rose-600",
    emoji: "🚗",
    sortOrder: 3,
  },
];

export const UNIT_GRADIENT_PRESETS = [
  "linear-gradient(135deg, #059669 0%, #10b981 50%, #14b8a6 100%)",
  "linear-gradient(135deg, #0d9488 0%, #0891b2 50%, #0284c7 100%)",
  "linear-gradient(135deg, #0891b2 0%, #0284c7 50%, #2563eb 100%)",
  "linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #4f46e5 100%)",
  "linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)",
  "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)",
  "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #c026d3 100%)",
  "linear-gradient(135deg, #9333ea 0%, #c026d3 50%, #db2777 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #dc2626 100%)",
  "linear-gradient(135deg, #ef4444 0%, #f43f5e 50%, #ec4899 100%)",
  "linear-gradient(135deg, #ec4899 0%, #d946ef 50%, #9333ea 100%)",
  "linear-gradient(135deg, #38bdf8 0%, #3b82f6 50%, #4f46e5 100%)",
] as const;

export const UNIT_ACCENT_PRESETS = [
  "text-emerald-600",
  "text-teal-600",
  "text-cyan-600",
  "text-sky-600",
  "text-blue-600",
  "text-indigo-600",
  "text-violet-600",
  "text-purple-600",
  "text-fuchsia-600",
  "text-amber-600",
  "text-red-600",
  "text-pink-600",
] as const;

export const UNIT_EMOJI_PRESETS = ["🏭", "⚙️", "💧", "🇮🇳", "⚡", "🚗", "✨", "🏢", "📦", "🔧"] as const;
