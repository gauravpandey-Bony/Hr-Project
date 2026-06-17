/**
 * Demo login accounts mapped to real Bony Polymers employees
 * (from DEFAULT_EMPLOYEES / employee master seed data).
 */
export const DEMO_ACCOUNTS = {
  admin: {
    userId: "demo-admin",
    email: "admin@bonypolymers.com",
    password: "admin123",
    name: "HR Administrator",
    role: "ADMIN" as const,
    title: "System Admin",
    department: "HR",
    location: "Bony Polymers",
    doj: null as string | null,
    ecn: null as string | null,
  },
  manager: {
    userId: "demo-manager",
    email: "praveen.kumar@bonypolymers.com",
    password: "praveen123",
    name: "Mr. Praveen Kumar",
    role: "MANAGER" as const,
    title: "Assistant Manager",
    department: "Store",
    location: "Bony Polymers",
    doj: "09.11.2020",
    ecn: "ECN-101047",
  },
  itManager: {
    userId: "demo-it-manager",
    email: "bhupesh.sharma@bonypolymers.com",
    password: "bhupesh123",
    name: "Bhupesh Sharma",
    role: "MANAGER" as const,
    title: "Sr. Manager",
    department: "IT",
    location: "Bony Polymers",
    doj: null as string | null,
    ecn: "101068",
  },
  rajKumar: {
    userId: "demo-raj-kumar",
    email: "raj.kumar@bonypolymers.com",
    password: "raj123",
    name: "Raj Kumar",
    role: "EMPLOYEE" as const,
    title: "Manager",
    department: "Plant Head",
    location: "Bony Polymers",
    doj: null as string | null,
    ecn: null as string | null,
  },
  sudhaJetli: {
    userId: "demo-sudha",
    email: "sudha.jetli@bonypolymers.com",
    password: "sudha123",
    name: "Ms. Sudha Jetli",
    role: "EMPLOYEE" as const,
    title: "Sr. Officer",
    department: "Billing",
    location: "Bony Polymers",
    doj: "26.03.2007",
    ecn: null as string | null,
    managerName: "Mr. Raj Kumar",
  },
  employee: {
    userId: "demo-employee",
    email: "mahima@bonypolymers.com",
    password: "mahima123",
    name: "Ms. Mahima",
    role: "EMPLOYEE" as const,
    title: "DEO",
    department: "Billing",
    location: "Bony Polymers",
    doj: "01.11.2022",
    ecn: null as string | null,
    managerName: "Mr. Raj Kumar",
  },
  sikandarKhan: {
    userId: "demo-sikandar-khan",
    email: "sikandar.khan@bonypolymers.com",
    password: "sikandar123",
    name: "Sikandar Khan",
    role: "EMPLOYEE" as const,
    title: "Sr. Engr-IT",
    department: "IT",
    location: "Plant Bony 24",
    doj: "19.07.2010",
    ecn: null as string | null,
    managerName: "Mr. Bhupesh Kumar, Sr. Manager",
  },
} as const;

export type DemoRoleKey = keyof typeof DEMO_ACCOUNTS;

export const DEMO_USERS = {
  admin: DEMO_ACCOUNTS.admin.userId,
  manager: DEMO_ACCOUNTS.manager.userId,
  itManager: DEMO_ACCOUNTS.itManager.userId,
  rajKumar: DEMO_ACCOUNTS.rajKumar.userId,
  sudhaJetli: DEMO_ACCOUNTS.sudhaJetli.userId,
  employee: DEMO_ACCOUNTS.employee.userId,
  sikandarKhan: DEMO_ACCOUNTS.sikandarKhan.userId,
} as const;

export const DEMO_CREDENTIALS = Object.fromEntries(
  (Object.keys(DEMO_ACCOUNTS) as DemoRoleKey[]).map((key) => {
    const a = DEMO_ACCOUNTS[key];
    return [
      key,
      {
        userId: a.userId,
        email: a.email,
        password: a.password,
        name: a.name,
        role: a.role,
        title: a.title,
        department: a.department,
        ecn: a.ecn,
      },
    ];
  })
) as Record<
  DemoRoleKey,
  {
    userId: string;
    email: string;
    password: string;
    name: string;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    title: string;
    department: string;
    ecn: string | null;
  }
>;

export function isValidDemoPassword(role: DemoRoleKey, password: string): boolean {
  return DEMO_ACCOUNTS[role].password === password;
}

export function demoRoleForUserId(userId: string): DemoRoleKey | null {
  for (const key of Object.keys(DEMO_ACCOUNTS) as DemoRoleKey[]) {
    if (DEMO_ACCOUNTS[key].userId === userId) return key;
  }
  return null;
}
