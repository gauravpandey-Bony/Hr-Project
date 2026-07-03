/** Map HR "Working Location" text → plant unit + canonical employee.location */

export type PlantLocationAssignment = {
  plantUnitKey: string;
  location: string;
};

type PlantRule = {
  test: RegExp;
  plantUnitKey: string;
  location: string;
};

/** Short labels from Staff Details "Plant Location" column */
const PLANT_LOCATION_LABELS: Record<string, PlantLocationAssignment> = {
  arshee: { plantUnitKey: "Arshee Auto", location: "Arshee Auto Faridabad" },
  "bony fluid": { plantUnitKey: "Bony Fluid 58", location: "Bony Fluid 58" },
  "bony- pune": { plantUnitKey: "Bony Pune", location: "Bony Pune" },
  "bony-24": { plantUnitKey: "Bony 24", location: "Bony 24 Faridabad" },
  "bony-37p": { plantUnitKey: "Bony Polymers", location: "Bony Polymers 37-P" },
  "bony-77": { plantUnitKey: "Bony 77", location: "Bony 77 Faridabad" },
  "bony-gujarat": { plantUnitKey: "Bony Gujrat", location: "Bony Gujrat" },
  "bony-manesar": { plantUnitKey: "Bony Maneshar", location: "Bony Maneshar" },
  corporate: { plantUnitKey: "Bony Corporate", location: "Bony Corporate Faridabad" },
  haridwar: { plantUnitKey: "Bony Haridwar 1", location: "Bony Haridwar 1" },
  prime: { plantUnitKey: "Prime India", location: "Prime India" },
  "saket-1": { plantUnitKey: "Saket Fabs Sheet Metal", location: "Saket Fabs Prithla" },
  "saket-2": { plantUnitKey: "Saket Fabs Sheet Metal", location: "Saket Fabs Ajronda" },
};

function normalizePlantLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const WORKING_LOCATION_RULES: PlantRule[] = [
  {
    test: /corporate/i,
    plantUnitKey: "Bony Corporate",
    location: "Bony Corporate Faridabad",
  },
  {
    test: /fluid/i,
    plantUnitKey: "Bony Fluid 58",
    location: "Bony Fluid 58",
  },
  {
    test: /prime\s*india/i,
    plantUnitKey: "Prime India",
    location: "Prime India",
  },
  {
    test: /arshee|neon/i,
    plantUnitKey: "Arshee Auto",
    location: "Arshee Auto Faridabad",
  },
  {
    test: /saket.*ajronda|ajronda/i,
    plantUnitKey: "Saket Fabs Sheet Metal",
    location: "Saket Fabs Ajronda",
  },
  {
    test: /saket.*prithla|prithla/i,
    plantUnitKey: "Saket Fabs Sheet Metal",
    location: "Saket Fabs Prithla",
  },
  {
    test: /saket/i,
    plantUnitKey: "Saket Fabs Sheet Metal",
    location: "Saket Fabs",
  },
  {
    test: /37\s*p|plot\s*no\.?\s*[-–]?\s*37\b/i,
    plantUnitKey: "Bony Polymers",
    location: "Bony Polymers 37-P",
  },
  {
    test: /plot\s*no\.?\s*[-–]?\s*77\b|\b77\b.*sector/i,
    plantUnitKey: "Bony 77",
    location: "Bony 77 Faridabad",
  },
  {
    test: /sector\s*[-–]?\s*24\b|plot\s*no\.?\s*[-–]?\s*132\b/i,
    plantUnitKey: "Bony 24",
    location: "Bony 24 Faridabad",
  },
  {
    test: /haridwar/i,
    plantUnitKey: "Bony Haridwar 1",
    location: "Bony Haridwar 1",
  },
  {
    test: /viramgam|gujrat|gujarat/i,
    plantUnitKey: "Bony Gujrat",
    location: "Bony Gujrat",
  },
  {
    test: /manesar|maneshar/i,
    plantUnitKey: "Bony Maneshar",
    location: "Bony Maneshar",
  },
  {
    test: /\bpune\b/i,
    plantUnitKey: "Bony Pune",
    location: "Bony Pune",
  },
];

export function resolvePlantFromWorkingLocation(
  raw: string | null | undefined
): PlantLocationAssignment {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { plantUnitKey: "Bony Polymers", location: "Bony Polymers 37-P" };
  }

  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
  for (const rule of WORKING_LOCATION_RULES) {
    if (rule.test.test(normalized) || rule.test.test(trimmed)) {
      return { plantUnitKey: rule.plantUnitKey, location: rule.location };
    }
  }

  return { plantUnitKey: trimmed, location: trimmed };
}

/** Prefer explicit Plant Location label from HR sheet, then working location text. */
export function resolvePlantAssignment(
  workingLocation?: string | null,
  plantLocationLabel?: string | null
): PlantLocationAssignment {
  const label = plantLocationLabel?.trim();
  if (label) {
    const mapped = PLANT_LOCATION_LABELS[normalizePlantLabel(label)];
    if (mapped) return mapped;

    const fromLabel = resolvePlantFromWorkingLocation(label);
    const labelKey = normalizePlantLabel(label);
    if (normalizePlantLabel(fromLabel.plantUnitKey) !== labelKey) {
      return fromLabel;
    }
  }

  return resolvePlantFromWorkingLocation(workingLocation);
}

export function summarizePlantAssignments(
  rows: { location?: string | null; plantUnitKey?: string | null }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const key =
      row.plantUnitKey?.trim() ||
      resolvePlantFromWorkingLocation(row.location).plantUnitKey;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
