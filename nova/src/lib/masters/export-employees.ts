import * as XLSX from "xlsx";

export type EmployeeExportRow = {
  name: string;
  designation: string | null;
  department: string | null;
  location: string | null;
  doj: string | null;
  ecn: string | null;
  managerName: string | null;
  sortOrder: number;
  isActive: boolean;
};

const HEADERS = [
  "Name",
  "Designation",
  "Department",
  "Location",
  "DOJ",
  "ECN",
  "Manager",
  "Sort Order",
  "Active",
] as const;

export function buildEmployeeMasterWorkbook(rows: EmployeeExportRow[]) {
  const data: (string | number)[][] = [
    [...HEADERS],
    ...rows.map((r) => [
      r.name,
      r.designation ?? "",
      r.department ?? "",
      r.location ?? "",
      r.doj ?? "",
      r.ecn ?? "",
      r.managerName ?? "",
      r.sortOrder,
      r.isActive ? "Yes" : "No",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
    { wch: 8 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Employee Master");
  return wb;
}

export function employeeMasterXlsxBuffer(rows: EmployeeExportRow[]): Buffer {
  const wb = buildEmployeeMasterWorkbook(rows);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function employeeMasterFilename(unitSlug?: string | null): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = unitSlug && unitSlug !== "all" ? `-${unitSlug}` : "";
  return `employee-master${suffix}-${date}.xlsx`;
}
