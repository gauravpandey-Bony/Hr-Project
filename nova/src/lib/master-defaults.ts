/** Default rows for Department master (seed + fallback) */
export const DEFAULT_DEPARTMENTS = [
  { name: "Plant Head", headName: "", kraSheetId: "plant", sortOrder: 1 },
  { name: "Production", headName: "", kraSheetId: "production", sortOrder: 2 },
  { name: "Quality Assurance", headName: "", kraSheetId: "qa", sortOrder: 3 },
  { name: "Maintenance", headName: "", kraSheetId: "maintenance", sortOrder: 4 },
  { name: "Store", headName: "", kraSheetId: "store", sortOrder: 5 },
  { name: "Billing", headName: "", kraSheetId: "billing", sortOrder: 6 },
  { name: "IT", headName: "", kraSheetId: "it", sortOrder: 7 },
] as const;
