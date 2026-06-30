import { readFileSync, existsSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { parseStaffDetailsRoster } from "../src/lib/masters/staff-details-roster";
import { enrichStaffDetailsManagers } from "../src/lib/masters/staff-details-import";
import { summarizePlantAssignments } from "../src/lib/masters/employee-plant-location";
import { normalizeRosterDepartment, ROSTER_DEPARTMENTS } from "../src/lib/masters/37p-roster";
import {
  dedupeDepartmentMasters,
  normalizeDepartmentMasterName,
  reconcileDepartmentAssignmentsForAllPlants,
  upsertDepartmentMaster,
} from "../src/lib/masters/department-master-sync";
import { DEFAULT_ORG_GROUPS, DEFAULT_STANDALONE_UNITS } from "../src/lib/org-units-defaults";
import { assignDepartmentKpisToEmployee } from "../src/lib/kpi/assign-department-kpis";

const ORG_SLUG = "bony-polymers";
const DEFAULT_FILE = "/Users/rampal/Desktop/Staff Details edp (1).xlsx";

function normalizeDepartment(name: string) {
  return normalizeRosterDepartment(name).masterName;
}

async function main() {
  const filePath = process.argv[2] ?? DEFAULT_FILE;
  if (!existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }

  const db = new PrismaClient();
  const org = await db.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (!org) {
    console.error("Organization not found");
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
  const { rows, errors } = parseStaffDetailsRoster(arrayBuffer);
  if (!rows.length) {
    console.error("Parse failed:", errors);
    process.exit(1);
  }

  console.log("Plant summary:", summarizePlantAssignments(rows));

  await enrichStaffDetailsManagers(db, org.id, rows);

  const deptByPlantKey = new Map<string, string>();
  for (const d of ROSTER_DEPARTMENTS) {
    const location = d.location ?? "Bony Polymers 37-P";
    const rosterKey = `${d.name}::${location}`;
    const { department } = await upsertDepartmentMaster(db, org.id, {
      name: d.name,
      location,
      plantUnitKey: "Bony 37P",
      kraSheetId: d.kraSheetId ?? null,
      sortOrder: d.sortOrder ?? 0,
      isActive: true,
    });
    deptByPlantKey.set(rosterKey, department.id);
  }
  await dedupeDepartmentMasters(db, org.id, "Bony 37P");

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const deptName = normalizeDepartmentMasterName(row.department);
    const location = row.location ?? "Bony Polymers 37-P";
    const deptKey = `${deptName}::${location}`;

    let departmentId = deptByPlantKey.get(deptKey);
    if (!departmentId) {
      const { department } = await upsertDepartmentMaster(db, org.id, {
        name: deptName,
        location,
        plantUnitKey: row.plantUnitKey ?? undefined,
        isActive: true,
      });
      departmentId = department.id;
      deptByPlantKey.set(deptKey, department.id);
    }

    const existing = row.ecn
      ? await db.employeeMaster.findFirst({
          where: { organizationId: org.id, ecn: row.ecn },
        })
      : await db.employeeMaster.findFirst({
          where: { organizationId: org.id, name: row.name! },
        });

    const data = {
      name: row.name!,
      designation: row.designation ?? null,
      departmentId,
      department: deptName,
      location,
      doj: row.doj ?? null,
      ecn: row.ecn ?? null,
      managerName: row.managerName ?? null,
      sortOrder: row.sortOrder ?? 0,
      isActive: true,
    };

    if (existing) {
      await db.employeeMaster.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.employeeMaster.create({
        data: { organizationId: org.id, ...data },
      });
      created++;
      if (data.department) {
        await assignDepartmentKpisToEmployee(org.id, {
          name: data.name,
          department: data.department,
          ecn: data.ecn,
        });
      }
    }
  }

  const allUnits = [
    ...DEFAULT_ORG_GROUPS.flatMap((g) => g.units),
    ...DEFAULT_STANDALONE_UNITS,
  ].map((u) => ({
    plantUnitKey: u.plantUnitKey,
    locationAliases: u.locationAliases ? [...u.locationAliases] : undefined,
    kpiPlantAliases: u.kpiPlantAliases ? [...u.kpiPlantAliases] : undefined,
  }));

  const reconcile = await reconcileDepartmentAssignmentsForAllPlants(
    db,
    org.id,
    allUnits
  );

  const count = await db.employeeMaster.count({
    where: { organizationId: org.id, isActive: true },
  });

  console.log(
    JSON.stringify(
      { created, updated, totalActive: count, reconcile, parseErrors: errors },
      null,
      2
    )
  );
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
