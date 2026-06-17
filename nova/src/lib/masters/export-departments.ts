import * as XLSX from "xlsx";

export type DepartmentExportRow = {
  name: string;
  headName: string | null;
  location: string | null;
  kraSheetId: string | null;
  sortOrder: number;
  isActive: boolean;
};

const HEADERS = [
  "Department",
  "Head",
  "Location",
  "KRA Sheet ID",
  "Sort Order",
  "Active",
] as const;

export function buildDepartmentMasterWorkbook(rows: DepartmentExportRow[]) {
  const data: (string | number)[][] = [
    [...HEADERS],
    ...rows.map((r) => [
      r.name,
      r.headName ?? "",
      r.location ?? "",
      r.kraSheetId ?? "",
      r.sortOrder,
      r.isActive ? "Yes" : "No",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 24 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 10 },
    { wch: 8 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Department Master");
  return wb;
}

export function departmentMasterXlsxBuffer(rows: DepartmentExportRow[]): Buffer {
  const wb = buildDepartmentMasterWorkbook(rows);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function departmentMasterFilename(unitSlug?: string | null): string {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = unitSlug && unitSlug !== "all" ? `-${unitSlug}` : "";
  return `department-master${suffix}-${date}.xlsx`;
}
