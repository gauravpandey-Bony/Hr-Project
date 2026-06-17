import * as XLSX from "xlsx";
import { isPercentUnit } from "@/lib/kra/target-format";

export type SheetCellRole =
  | "annual"
  | "quarterTarget"
  | "quarterAchieved"
  | "total"
  | "other";

/** Excel blank cells often store raw 1 with 100% number format */
export function isExcelPercentPlaceholder(
  cell: XLSX.CellObject | undefined
): boolean {
  if (!cell) return false;
  const w = cell.w != null ? String(cell.w).trim() : "";
  return cell.v === 1 && w === "100%";
}

/** Quarterly target cells — keep Excel display text exactly (25%, 1.00, <= 24Hrs, etc.) */
export function readQuarterTargetCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number
): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell || cell.v == null || cell.v === "") return "";
  if (cell.w != null && String(cell.w).trim()) return String(cell.w).trim();
  return String(cell.v).trim();
}

export function readSheetCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  unit: string,
  role: SheetCellRole = "other"
): string {
  if (role === "quarterTarget") {
    return readQuarterTargetCell(ws, r, c);
  }

  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell || cell.v == null || cell.v === "") return "";

  const display = cell.w != null ? String(cell.w).trim() : "";

  if (isExcelPercentPlaceholder(cell)) {
    const keep =
      role === "annual" ||
      role === "total" ||
      (isPercentUnit(unit) && role === "quarterAchieved");
    if (keep && isPercentUnit(unit)) return display || "100%";
    if (role === "quarterAchieved") return "";
    return "";
  }

  if (!isPercentUnit(unit) && display.includes("%") && role === "quarterAchieved") {
    return "";
  }

  if (display) return display;
  return String(cell.v).trim();
}

export function readNumericWeightage(
  ws: XLSX.WorkSheet,
  r: number,
  col: number,
  fallback: unknown
): number {
  const addr = XLSX.utils.encode_cell({ r, c: col });
  const cell = ws[addr];
  const raw = cell?.v ?? fallback;
  if (typeof raw === "number" && !Number.isNaN(raw)) return raw;
  const n = parseFloat(String(raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}
