# Bony KPI (Nova) — Complete Project Guide

**Organization:** Bony Polymers Pvt Ltd  
**Product:** Bony KPI  
**AI Assistant:** Maya  
**Version:** 2026  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Who Uses the System](#2-who-uses-the-system)
3. [How Data Flows (Admin → Employee)](#3-how-data-flows-admin--employee)
4. [What Each Role Can Do](#4-what-each-role-can-do)
5. [Daily Workflows](#5-daily-workflows)
6. [Maya AI Assistant](#6-maya-ai-assistant)
7. [HR Processes](#7-hr-processes)
8. [Dashboard Pages](#8-dashboard-pages)
9. [KPI System Explained](#9-kpi-system-explained)
10. [Multi-Plant Structure](#10-multi-plant-structure)
11. [Technical Overview](#11-technical-overview)
12. [Setup & Environment](#12-setup--environment)
13. [Project Status](#13-project-status)

---

## 1. Project Overview

**Bony KPI** is a KPI tracking and HR performance platform built for **Bony Polymers Pvt Ltd**. It replaces spreadsheet-based KRA/KPI tracking with a modern web dashboard.

### What the system does

- Track KPIs across plants, departments, and individuals
- Import employee and department data from Excel/CSV
- Display dashboards with green/red performance status
- Provide **Maya AI** — a voice-enabled assistant for reports and queries
- Support HR modules: reviews, 360° feedback, goals, surveys, calibration, compensation

### Technology (brief)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 |
| UI | React, Tailwind CSS |
| Database | SQLite + Prisma |
| AI | OpenAI (GPT, Whisper, TTS) |
| Voice | Browser Speech API |

---

## 2. Who Uses the System

| Role | Who they are | Example |
|------|--------------|---------|
| **Admin (HR / System)** | Full company access | HR Administrator |
| **Manager** | Head of a team or department | Bhupesh Sharma (IT), Praveen Kumar (Store) |
| **Employee** | Individual staff member | Mahima, Sudha Jetli |

### Where each person lands after login

| Role | Home page after login |
|------|----------------------|
| **Admin** | Unit picker — choose which plant to view |
| **Manager** | Team Reports |
| **Employee** | My Dashboard (own KPIs only) |

---

## 3. How Data Flows (Admin → Employee)

```
ADMIN enters:
  • Who works here (employees)
  • Which department they belong to
  • KPI targets (e.g. Production target = 95%)
         ↓
MANAGER monitors:
  • Team performance
  • Who is behind target
  • Can edit team KRAs
         ↓
EMPLOYEE updates:
  • Actual numbers (e.g. production achieved = 88%)
  • Completes assigned reviews
         ↓
SYSTEM calculates:
  • Target vs Actual comparison
  • Green = on track (progress ≥ 20%)
  • Red = below target
         ↓
EVERYONE sees results (at their level):
  • Admin → entire company
  • Manager → their team only
  • Employee → themselves only
```

### Data setup flow

1. **Admin** loads company data — departments, employees, KPI targets
2. **Managers** monitor their teams using that data
3. **Employees** enter their actual KPI values
4. Everyone sees results on the **dashboard**

---

## 4. What Each Role Can Do

### ADMIN — Full company access

| Task | Description |
|------|-------------|
| Select Unit | Pick any plant (37P, 77, 24…) and view its dashboard |
| Department Master | Add/edit departments |
| Employee Master | Full employee list management |
| KRA / KPI Sheet | Set company-wide targets and goals |
| KPI Library | View all KPIs, create new ones |
| Update Data | Enter or change any KPI value |
| Reports | Company-wide rankings and league tables |
| Employee Report | Full report for any employee by name |
| Maya AI | Ask anything across the whole organization |
| Reviews, 360°, Goals, Surveys | Start and manage HR processes |
| Settings | HRIS, Teams, integrations |
| Excel/CSV upload | Bulk import employees, departments, KPIs |

**Cannot be restricted** — Admin has access to everything.

---

### MANAGER — Team / department only

| ✅ Can do | ❌ Cannot do |
|-----------|--------------|
| View their team's KPIs | Edit Department Master |
| Team Reports | Org-wide employee reports |
| Edit team KRAs | Access full Settings |
| Update KPI data (own + team) | Choose any plant (unit picker) |
| KPI Dashboard, Library, KRA sheet | — |
| Maya AI (for their unit) | — |
| Reviews (own + team) | — |
| Goals, 360°, Surveys, Analytics | — |

**Team matching:** System finds employees in the same department whose manager name matches.

---

### EMPLOYEE — Own data only

| ✅ Can do | ❌ Cannot do |
|-----------|--------------|
| My Dashboard — KPI overview | Maya AI |
| My KPIs — personal list | Reports, Analytics |
| Update Data — enter own KPI values | Employee / Department Master |
| My Reviews — complete performance review | Goals, 360°, Surveys |
| View their unit dashboard | KRA Master Sheet, Settings |

---

### Quick comparison table

| Feature | Admin | Manager | Employee |
|---------|-------|---------|----------|
| All plants / units | ✅ | ❌ | ❌ |
| Department Master | ✅ | ❌ | ❌ |
| Employee Master | ✅ | ❌ | ❌ |
| KRA Master Sheet | ✅ | ✅ | ❌ |
| KPI Dashboard | ✅ | ✅ | ✅ (own only) |
| Update Data | ✅ (all) | ✅ (team) | ✅ (own) |
| Reports (org-wide) | ✅ | ❌ | ❌ |
| Team Reports | ✅ | ✅ | ❌ |
| Maya AI | ✅ | ✅ | ❌ |
| Reviews | ✅ (all) | ✅ (team) | ✅ (own) |
| Goals / 360° / Surveys | ✅ | ✅ | ❌ |
| Settings | ✅ | ✅ | ❌ |

---

## 5. Daily Workflows

### Admin — typical day

```
1. Log in
2. Choose a plant (e.g. Bony 37P)
3. Check / update employee list
4. Import or edit KRA sheet
5. View dashboard — identify weak departments
6. Ask Maya: "production department report"
7. Launch review cycle (yearly)
```

### Manager — typical day

```
1. Log in
2. Open Team Reports
3. See who is on track vs off target
4. Edit team KRA if targets changed
5. Enter team KPI values in Update Data
6. Ask Maya: "Maya, Mahima employee report"
7. Complete team reviews
```

### Employee — typical day

```
1. Log in
2. Open My Dashboard
3. Check if KPIs are green or red
4. Go to Update Data → enter monthly/daily values
5. Complete review if assigned
```

### Full process sequence

```
STEP 1 — Setup (Admin, once/monthly)
  → Upload departments + employees
  → Set KPI targets / KRA sheet
  → Configure plants (37P, 77...)

STEP 2 — Daily work (Manager + Employee)
  → Employee updates own KPI values
  → Manager checks + updates team KPIs
  → System shows team report + personal dashboard

STEP 3 — Reports (Admin + Manager)
  → Ask Maya for employee or department reports
  → View league tables and analytics

STEP 4 — HR (Admin, yearly/quarterly)
  → Start review cycle
  → Managers + employees complete reviews
  → Calibration + compensation
```

---

## 6. Maya AI Assistant

**Maya** is the built-in AI assistant for KPI and HR queries.

### Who can use Maya?

| Who | Access | What they can ask |
|-----|--------|-------------------|
| **Admin** | ✅ Yes | Any employee, department, or plant |
| **Manager** | ✅ Yes | Their unit / team only |
| **Employee** | ❌ No | — |

### How to use Maya (voice)

1. Tap **Hey Maya** or the mic button (one time — grants mic permission)
2. Say **"Hey Maya"** → chime plays, system becomes active
3. Say your command: **"Maya, Bhupesh Sharma report"** or **"Maya, show all KPIs"**
4. Maya displays the answer — text, tables, or dashboard cards
5. Mic automatically resumes for the next command

### How to use Maya (text)

Type in the chat box:
- `Maya, Bhupesh Sharma report`
- `Maya, production department report`
- `Maya, show all KPIs`

### What Maya can answer

- Individual employee KPI reports (by name or ECN)
- Department performance reports
- KPI lookups and summaries
- General questions about org data (when OpenAI is configured)
- KPI suggestions for admins

### Voice flow (simplified)

```
User says "Hey Maya"
  → System activates (chime)
User says command
  → Speech converted to text
  → System finds the right report
  → Data fetched from database
  → Report shown in chat
  → Mic resumes for next command
```

---

## 7. HR Processes

### Performance review cycle

```
Admin starts review cycle
    ↓
Each employee gets a review assignment
    ↓
Employee completes self-review
Manager writes team reviews
    ↓
Admin reviews all submissions
    ↓
Calibration meeting (Nine-box talent grid)
    ↓
Compensation recommendations (bonus / increment)
```

### Other HR modules

| Module | Purpose |
|--------|---------|
| **Reviews** | Formal performance review cycles |
| **360° Feedback** | Peer and manager feedback campaigns |
| **Goals** | OKR-style objectives and key results |
| **Surveys** | Pulse / engagement surveys |
| **Calibration** | Talent grid (nine-box) sessions |
| **Compensation** | Merit and bonus recommendations |

---

## 8. Dashboard Pages

| Page | Who uses it | Purpose |
|------|-------------|---------|
| Unit Picker | Admin | Choose which plant to view |
| KPI Dashboard | All | Gauges, charts, health mix |
| KPI Library | All | Table of all KPIs |
| Update Data | All | Log new KPI values |
| KRA Master Sheet | Admin, Manager | Spreadsheet view of KRAs |
| Maya AI | Admin, Manager | Chat + voice assistant |
| Department Master | Admin | Manage departments |
| Employee Master | Admin | Manage employees |
| Reports | Admin | League table / rankings |
| Employee Report | Admin | Individual employee report |
| Team Reports | Manager | Team performance view |
| My Team KRA | Manager | Edit team KRAs |
| Reviews | All (scoped) | Performance reviews |
| Goals | Admin, Manager | OKRs |
| 360° Feedback | Admin, Manager | Peer feedback |
| Surveys | Admin, Manager | Pulse surveys |
| Analytics | Admin, Manager | Charts and insights |
| Calibration | Admin, Manager | Nine-box sessions |
| Compensation | Admin, Manager | Pay recommendations |
| Settings | Admin, Manager | Integrations |

---

## 9. KPI System Explained

### KPI levels

| Level | Example |
|-------|---------|
| **Plant** | Overall production output for 37P |
| **Department** | IT uptime, Billing accuracy |
| **Individual** | Employee-specific targets |

### Status colors

| Color | Meaning |
|-------|---------|
| **Green** | On track — progress at or above 20% of target |
| **Red** | Off target — below threshold |

### KPI categories

Production · Quality · Sales · Maintenance · Safety · Finance · Process · Store · Billing · HR · IT

### How progress is calculated

- System compares **actual value** vs **target value**
- Direction matters: some KPIs are "higher is better", others "lower is better"
- KRA weightage is factored in for weighted scores
- Latest logged entry or quarterly achieved value is used as current value

---

## 10. Multi-Plant Structure

Bony Polymers operates multiple plants. Each is a **unit** in the system.

| Plant | Unit ID |
|-------|---------|
| Bony 37P | bony-37p |
| Bony 77 | bony-77 |
| Bony 24 | bony-24 |
| Maneshar | bony-maneshar |
| (+ more plants) | ... |

- **Admin** can switch between any plant
- **Manager / Employee** see data scoped to their plant and role
- Primary demo data is loaded for **Bony 37P**

---

## 11. Technical Overview

### Architecture (simple)

```
Browser (User)
    ↓
Next.js App (pages + API)
    ↓
Business Logic (src/lib)
    ↓
Database (SQLite via Prisma)
    ↓
External: OpenAI (chat, voice, TTS)
```

### Key folders

```
nova/
├── prisma/          Database schema + seed data
├── scripts/         Import tools (Excel, KRA workbooks)
├── src/
│   ├── app/         Pages and API routes
│   ├── components/  UI components
│   ├── hooks/       Voice / Maya hooks
│   └── lib/         Business logic
└── public/          Logos and assets
```

### Demo login accounts

| Role | User ID | Password |
|------|---------|----------|
| Admin | demo-admin | admin123 |
| Manager (Store) | demo-manager | praveen123 |
| Manager (IT) | demo-it-manager | bhupesh123 |
| Employee | demo-employee | mahima123 |
| Employee | demo-sudha | sudha123 |

---

## 12. Setup & Environment

### Run locally

```bash
cd nova
npm install
npm run db:seed    # Load demo data
npm run dev        # Start at http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| DATABASE_URL | Yes | SQLite database path |
| OPENAI_API_KEY | Optional | Maya AI, voice, TTS |
| OPENAI_MODEL | Optional | Default: gpt-4o-mini |
| NEXT_PUBLIC_APP_URL | Optional | App base URL |

### Import commands

```bash
npm run import:37p        # Import 37P employee roster
npm run import:kra        # Import KRA employee workbook
npm run import:plant-kra  # Import plant-level KRA workbook
```

---

## 13. Project Status

| Area | Status |
|------|--------|
| KPI dashboard, tracking, library | ✅ Complete |
| Multi-unit org structure | ✅ Complete |
| Department & employee masters | ✅ Complete |
| Data import (Excel/CSV/seed) | ✅ Complete |
| Maya AI text chat + reports | ✅ Complete |
| Maya voice (Hey Maya) | ✅ Working |
| Role-based access control | ✅ Complete |
| Performance reviews, 360°, goals | ✅ UI + API (demo data) |
| HRIS / Teams integrations | ⚠️ Partial (stubs) |
| Production auth (OAuth) | ❌ Demo login only |
| PostgreSQL / production deploy | ❌ SQLite dev only |

---

## One-Line Summary

| Role | Summary |
|------|---------|
| **Admin** | Sets up data, sees everything, runs HR, asks Maya anything |
| **Manager** | Monitors their team, updates team KPIs, views team reports |
| **Employee** | Updates only their own KPIs and completes their reviews |

---

*Document generated for Bony Polymers — Bony KPI Project*  
*Path: `/nova/BONY_KPI_PROJECT_GUIDE.md`*
