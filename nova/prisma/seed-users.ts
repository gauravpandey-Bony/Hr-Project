/**
 * Initial demo users — passwords hashed into DB at seed time only.
 * Override via env: SEED_USER_<USER_ID>_PASSWORD (dashes → underscores, uppercased)
 * Example: SEED_USER_demo_admin_PASSWORD=admin123
 */
export type SeedUserDef = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  title: string;
  department: string;
  defaultPassword: string;
  ecn?: string | null;
};

export const SEED_USERS: SeedUserDef[] = [
  {
    id: "demo-admin",
    email: "admin@bonypolymers.com",
    name: "HR Administrator",
    role: "ADMIN",
    title: "System Admin",
    department: "HR",
    defaultPassword: "admin123",
  },
  {
    id: "demo-manager",
    email: "praveen.kumar@bonypolymers.com",
    name: "Mr. Praveen Kumar",
    role: "MANAGER",
    title: "Assistant Manager",
    department: "Store",
    defaultPassword: "praveen123",
    ecn: "ECN-101047",
  },
  {
    id: "demo-it-manager",
    email: "bhupesh.sharma@bonypolymers.com",
    name: "Bhupesh Sharma",
    role: "ADMIN",
    title: "Sr. Manager",
    department: "IT",
    // Permanent super-admin: password always equals ECN
    defaultPassword: "101068",
    ecn: "101068",
  },
  {
    id: "demo-raj-kumar",
    email: "raj.kumar@bonypolymers.com",
    name: "Raj Kumar",
    role: "EMPLOYEE",
    title: "Manager",
    department: "Production",
    defaultPassword: "raj123",
  },
  {
    id: "demo-sudha",
    email: "sudha.jetli@bonypolymers.com",
    name: "Ms. Sudha Jetli",
    role: "EMPLOYEE",
    title: "Sr. Officer",
    department: "Billing",
    defaultPassword: "sudha123",
  },
  {
    id: "demo-employee",
    email: "mahima@bonypolymers.com",
    name: "Ms. Mahima",
    role: "EMPLOYEE",
    title: "DEO",
    department: "Billing",
    defaultPassword: "mahima123",
  },
  {
    id: "demo-sikandar-khan",
    email: "sikandar.khan@bonypolymers.com",
    name: "Sikandar Khan",
    role: "EMPLOYEE",
    title: "Sr. Engr-IT",
    department: "IT",
    defaultPassword: "sikandar123",
  },
  {
    id: "demo-ravi-bhati",
    email: "ravi.bhati@bonypolymers.com",
    name: "Ravi Bhati",
    role: "EMPLOYEE",
    title: "Senior Executive",
    department: "Logistics",
    defaultPassword: "ravi123",
    ecn: "100649",
  },
  {
    id: "demo-lokranjan-dixit",
    email: "lokranjan.dixit@bonypolymers.com",
    name: "Lokranjan Dixit",
    role: "EMPLOYEE",
    title: "Executive",
    department: "Logistics",
    defaultPassword: "lok123",
    ecn: "101591",
  },
];

export function seedPasswordForUser(userId: string, defaultPassword: string): string {
  const envKey = `SEED_USER_${userId.replace(/-/g, "_").toUpperCase()}_PASSWORD`;
  return process.env[envKey]?.trim() || defaultPassword;
}
