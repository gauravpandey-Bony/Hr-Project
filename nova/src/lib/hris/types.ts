export interface HrisEmployee {
  externalId: string;
  email: string;
  name: string;
  title?: string;
  department?: string;
  managerExternalId?: string;
  status?: "active" | "terminated";
}

export interface HrisSyncPayload {
  employees: HrisEmployee[];
  syncedAt: string;
  source: string;
}

export interface FieldMapping {
  externalId: string;
  email: string;
  name: string;
  title?: string;
  department?: string;
  managerId?: string;
}
