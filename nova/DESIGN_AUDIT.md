# Nova UI/UX Audit & Design System

## 1. UI audit (before modernization)

| Screen | Findings |
|--------|----------|
| **Landing** | Solid structure; inconsistent tokens; flat CTAs; no sticky nav blur |
| **Dashboard layout** | Fixed dark sidebar only; empty header slot; no global search or ⌘K |
| **KPI Dashboard** | Strong hero; ad-hoc animation classes; dense action row on mobile |
| **KPI Library** | Raw HTML table; no sticky header; basic toolbar dropdown |
| **Track / Forms** | Plain headings; minimal validation affordances |
| **Reports** | Rich visuals but custom drawer overlay (not shared primitive) |
| **HR pages** | Repeated `text-2xl font-bold` headers; table patterns duplicated |
| **Modals** | Custom `fixed inset-0` overlays (inconsistent a11y/focus trap) |
| **Design tokens** | Only `--background` / `--foreground`; slate hard-coded everywhere |

## 2. UX recommendations (implemented or staged)

### Implemented
- **Design tokens** — HSL semantic palette (primary, muted, sidebar, success, warning)
- **8px grid** — Spacing via Tailwind scale (`p-4`, `gap-2`, `h-9`, etc.)
- **Collapsible sidebar** — Persisted in `localStorage`; tooltips when collapsed
- **Sticky header** — Global search trigger + user menu; mobile menu overlay
- **Command palette** — `⌘K` / `Ctrl+K` via cmdk + Radix Dialog
- **ShadCN primitives** — Button, Input, Dialog, Sheet, Table, Dropdown, Command
- **Tables** — Sticky headers on KPI Library; shared `Table` components
- **Empty states** — Reusable `EmptyState` on KPI Library & Track
- **Page headers** — `PageHeader` for consistent hierarchy
- **Notifications** — Sonner toasts (ready for form success hooks)
- **Motion** — Framer Motion on landing, KPI stat cards (`MotionFadeUp`, `MotionNumber`)
- **Accessibility** — Focus rings, `aria-current`, `aria-label`s, keyboard command palette

### Phase 2 (completed)
- Migrated modals: `connect-app`, `generate-kpis`, `generate-kpi-prompt` → Radix `Dialog`
- Reports KPI drawer → Radix `Sheet`
- **Sonner toasts** on forms: create/update KPI, upload CSV, reviews, AI generate, integrations
- **Dark mode** toggle in dashboard header (`ThemeToggle`)
- **HR pages**: Reviews, Compensation, Feedback — `PageHeader` + sticky tables
- **KPI detail** history table + design tokens
- **`StickyTableShell`** reusable wrapper for scrollable tables

### Recommended next (no business-logic changes)
- Add **saved views** + column resize to KRA sheets (largest tables)
- **Column resizing** on KPI Library via `@tanstack/react-table` (optional dep)
- Polish KRA sheet tables with `StickyTableShell` (wide horizontal scroll)

## 3. Design system

### Color tokens (`globals.css`)
- `--primary` — Brand emerald
- `--muted` / `--muted-foreground` — Secondary text & surfaces
- `--sidebar-*` — Navigation chrome
- `--success` / `--warning` / `--destructive` — Status semantics

### Typography
- **Display**: `text-3xl`–`text-5xl` `font-bold tracking-tight` (page heroes)
- **Page title**: `PageHeader` → `text-2xl`/`text-3xl` `font-semibold`
- **Section**: `text-sm uppercase tracking-widest text-muted-foreground`
- **Body**: `text-sm` default; `text-xs` / `text-2xs` for meta

### Spacing (8px grid)
- Page padding: `p-4` → `p-8` responsive
- Card padding: `p-5` / `p-6`
- Control height: `h-9` (36px)
- Section gaps: `space-y-6` / `gap-4`

### Components (`src/components/ui/`)
`button`, `input`, `label`, `card`, `badge`, `dialog`, `sheet`, `table`, `data-table`, `command`, `dropdown-menu`, `tooltip`, `scroll-area`, `skeleton`, `page-header`, `empty-state`, `motion`

### Layout (`src/components/layout/`)
`app-shell`, `sidebar`, `dashboard-header`, `command-menu`, `user-switcher`

## 4. File map

| Area | Key files |
|------|-----------|
| Tokens | `src/app/globals.css`, `tailwind.config.ts` |
| Navigation data | `src/lib/navigation.ts` |
| App chrome | `src/components/layout/app-shell.tsx` |
| ShadCN config | `components.json` |

## 5. Verification

```bash
cd nova && npm run build
```

Test checklist:
- [ ] Sidebar collapse persists after refresh
- [ ] `⌘K` opens command palette; selecting item navigates
- [ ] Mobile: menu button opens sidebar overlay
- [ ] KPI Library: sticky table header on scroll
- [ ] Upload modal: focus trap, Escape closes
- [ ] All existing routes and actions unchanged
