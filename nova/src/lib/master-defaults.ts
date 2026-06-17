/** Default rows for Department & Employee masters (seed + fallback) */
export const DEFAULT_DEPARTMENTS = [
  { name: "Plant Head", headName: "", kraSheetId: "plant", sortOrder: 1 },
  { name: "Production", headName: "", kraSheetId: "production", sortOrder: 2 },
  { name: "Quality Assurance", headName: "", kraSheetId: "qa", sortOrder: 3 },
  { name: "Maintenance", headName: "", kraSheetId: "maintenance", sortOrder: 4 },
  { name: "Store", headName: "", kraSheetId: "store", sortOrder: 5 },
  { name: "Billing", headName: "", kraSheetId: "billing", sortOrder: 6 },
  { name: "IT", headName: "", kraSheetId: "it", sortOrder: 7 },
] as const;

export const DEFAULT_EMPLOYEES = [
  {
    name: "Mr. Praveen Kumar",
    designation: "Assistant Manager",
    department: "Store",
    location: "Bony Polymers",
    doj: "09.11.2020",
    ecn: "ECN-101047",
    managerName: "",
    sortOrder: 1,
  },
  {
    name: "Ms. Sudha Jetli",
    designation: "Sr. Officer",
    department: "Billing",
    location: "Bony Polymers",
    doj: "26.03.2007",
    ecn: "",
    managerName: "",
    sortOrder: 2,
  },
  {
    name: "Ms. Mahima",
    designation: "DEO",
    department: "Billing",
    location: "Bony Polymers",
    doj: "01.11.2022",
    ecn: "",
    managerName: "Mr. Raj Kumar",
    sortOrder: 3,
  },
] as const;
