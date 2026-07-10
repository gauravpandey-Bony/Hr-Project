# Bony KPI — SimpleKPI-style tracking for Bony Polymers

**Bony Polymers Pvt Ltd** KPI dashboard: gauges, trends, simple data entry, and league-table reports — inspired by [SimpleKPI](https://www.simplekpi.com/).

## Features

- **KPI Dashboard** — Green / amber / red gauges by category
- **KPI Library** — All metrics in one table
- **Update Data** — Quick form (no spreadsheets)
- **Reports** — League tables by Production, Quality, Safety, etc.
- **People & HR** (sidebar) — Reviews, feedback, surveys (optional)

## Quick start

```bash
cd nova
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Open **http://localhost:3000/dashboard**

### Demo login (prefilled on home / `/login`)

| Role | Real employee | User ID | Password | Email |
|------|---------------|---------|----------|-------|
| **Admin** | Ms. Sudha Jetli (Sr. Officer, Billing) | `demo-admin` | `sudha123` | sudha.jetli@bonypolymers.com |
| **Employee (Raj Kumar)** | Raj Kumar (Manager, Plant Head) | `demo-raj-kumar` | `raj123` | raj.kumar@bonypolymers.com |
| **IT Sr Manager** | Bhupesh Sharma (Sr. Manager, IT · ECN 101068) | `demo-it-manager` / `101068` | `101068` | bhupesh.sharma@bonypolymers.com |
| **IT Super Admin** | Gaurav Pandey (ECN 101008) | `101008` | `101008` | — |
| **Store Manager** | Mr. Praveen Kumar (Asst. Manager, Store) | `demo-manager` | `praveen123` | praveen.kumar@bonypolymers.com |
| **Employee** | Ms. Mahima (DEO, Billing) | `demo-employee` | `mahima123` | mahima@bonypolymers.com |

## Sample KPIs (seeded)

- On-time dispatch % (Sales)
- Defect rate (Quality)
- Production output MT (Production)
- Safety incidents (Safety)
- Machine downtime (Maintenance)
- Monthly sales ₹ Lakh (Finance)

## Tech

Next.js 14 · Prisma · SQLite · Tailwind CSS
