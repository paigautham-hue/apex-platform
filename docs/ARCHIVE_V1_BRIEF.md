# APEX Platform — Enhancement Brief for Claude Code

## CONTEXT: What You're Working On

APEX is a **governance operating system** for the Manipal Evergreen Fund (MEF) — a permanent capital vehicle managing 13 portfolio companies worth ₹5,139 Crores in combined FY27 revenue. The platform tracks organizational health, financial performance, personal reflection, and accountability across 13 CXO roles and 13 portfolio company CEOs.

**Current state**: ~80% built. Auth, RBAC, observation capture, AI-powered reviews, incentive modeling, financial upload, meetings, and reflections are functional. The codebase is clean, type-safe, and well-structured.

**What's missing**: The Evergreen Fund's specific governance model — the ship metaphor visual layer, monthly rating cycles with blind assessment, personal mandate workspaces ("My Bridge" for CXOs, "My Island" for CEOs), perception gap analysis, 360 feedback, dependency chain visualization, and the Financial Cockpit with budget-vs-actuals.

**Your job**: Enhance APEX to become the Evergreen Fund's complete governance OS. Build incrementally. Don't rewrite what works — extend it.

---

## TECH STACK (Do Not Change)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19 + Vite 7 | SPA with wouter routing |
| Styling | Tailwind CSS 4.1 | Custom dark theme tokens |
| UI Components | Radix UI + shadcn/ui | Located in `client/src/components/ui/` |
| State/Data | React Query + tRPC | End-to-end type safety |
| Backend | Express + tRPC | `server/routers.ts` is the main API file |
| Database | MySQL + Drizzle ORM | Schema in `drizzle/schema.ts` |
| Auth | Jose (JWT) | Custom auth, not NextAuth |
| AI | Custom RAG pipeline | `server/ai-ask.ts`, `server/ai-review.ts` |
| Package Manager | pnpm | Run `pnpm install`, NOT npm |

---

## CODEBASE MAP

```
apex-platform/
├── client/src/
│   ├── App.tsx                    # Routes (wouter Switch)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives (Button, Card, Dialog, etc.)
│   │   ├── DashboardLayout.tsx    # Sidebar + main content wrapper
│   │   ├── CommandPalette.tsx     # Cmd+K search
│   │   ├── MobileBottomNav.tsx    # Mobile navigation
│   │   ├── FloatingActionButton.tsx
│   │   ├── SortableTable.tsx      # Reusable sortable table
│   │   ├── ObservationTimeline.tsx
│   │   ├── VoiceInput.tsx         # Web Speech API
│   │   └── ...
│   ├── pages/
│   │   ├── TodayFeed.tsx          # Main dashboard/feed
│   │   ├── People.tsx             # People directory
│   │   ├── PersonProfile.tsx      # Individual profile view
│   │   ├── Capture.tsx            # Observation capture
│   │   ├── Goals.tsx              # Goal cascading
│   │   ├── Analytics.tsx          # Charts and analytics
│   │   ├── Reflections.tsx        # Self-reflection journal
│   │   ├── Meetings.tsx           # 1:1 meeting tracker
│   │   ├── AskInterface.tsx       # AI natural language queries
│   │   ├── Financial.tsx          # Financial data views
│   │   ├── IncentiveSimulator.tsx # What-if payout modeling
│   │   ├── Admin.tsx              # Admin panel
│   │   └── ...
│   ├── contexts/ThemeContext.tsx   # Dark/light mode
│   └── hooks/                     # Custom React hooks
├── server/
│   ├── _core/
│   │   ├── index.ts               # Express server entry
│   │   ├── trpc.ts                # tRPC setup, publicProcedure, protectedProcedure
│   │   ├── systemRouter.ts        # Health checks
│   │   └── cookies.ts             # Session cookie config
│   ├── routers.ts                 # ALL tRPC routers (~835 lines)
│   ├── db.ts                      # Database query functions (~600 lines)
│   ├── ai-ask.ts                  # RAG pipeline for Ask interface
│   ├── ai-review.ts               # Living review draft generation
│   ├── ai-extraction.ts           # File content extraction
│   ├── living-review-draft.ts     # Review draft lifecycle
│   ├── query-cache.ts             # Query result caching
│   └── storage.ts                 # S3 file storage
├── drizzle/
│   ├── schema.ts                  # ALL table definitions (~599 lines, 26 tables)
│   ├── relations.ts               # Drizzle relation definitions
│   └── migrations/                # SQL migration files
├── shared/
│   ├── types.ts                   # Re-exports schema types
│   ├── const.ts                   # Cookie name, shared constants
│   └── constants.ts               # CORE_VALUES, OBSERVATION_TEMPLATES
├── package.json
├── drizzle.config.ts
├── vite.config.ts
└── todo.md                        # Detailed feature checklist (28KB)
```

---

## EXISTING DATABASE TABLES (drizzle/schema.ts)

**26 tables already exist. Do NOT recreate them. Only ADD new tables or ALTER existing ones.**

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | Auth accounts | openId, email, role (user/admin) |
| `tenants` | Multi-tenant isolation | name, slug |
| `orgUnits` | Org hierarchy (holding → portfolio → function → team) | type, parentOrgUnitId, lifecycleStage |
| `persons` | Individuals | userId, currentRoleId, valuesProfile, capabilityProfile |
| `roles` | Role assignments | title, roleType (CEO/CXO/CHAIRMAN/etc.), personId, orgUnitId |
| `plans` | Goal cascading | type (PORTFOLIO_STRATEGY → INDIVIDUAL_GOAL), parentPlanId, weightPercentage |
| `metrics` | KPIs | planId, targetValue, updateCadence, driverTreePosition |
| `metricValues` | Time-series actuals | metricId, periodDate, actualValue, targetValue |
| `evidence` | Files/documents | type, credibilityTier, visibility, sourceType |
| `observations` | Structured feedback | observerPersonId, subjectPersonId, direction, valueTags |
| `selfReflections` | Personal journals | personId, type, visibility (PRIVATE→SHARED→IN_REVIEW) |
| `memories` | AI-synthesized claims | confidenceScore, embeddingVector, expiryTriggers |
| `assessments` | Performance reviews | type (MILESTONE/QUARTERLY/ANNUAL), performanceScores, quadrant |
| `reviews` | Living review drafts | aiGeneratedDraft, managerEditedVersion, employeeResponse, status |
| `meetings` | 1:1 tracking | managerPersonId, subjectPersonId, type |
| `incentiveConfigs` | Payout configuration | slabStructure, financialWeight, cxoCascadeOverrides |
| `incentiveComputations` | Calculated payouts | financialActuals, achievementPercentages, totalProjectedPayout |
| `calibrationSessions` | Review calibration | status (ASYNC→DISAGREEMENTS→LIVE→COMPLETED) |
| `decisions` | Decision journal | assumptions, risksIdentified, outcomeAssessment |
| `notifications` | Budgeted notifications | type (6 types), max 3/day per person |
| `financialUploads` | AI extraction from files | fileHash (dedup), extractedData, confidenceScores |
| `financialTemplates` | Learned file patterns | extractionRules, learnedPatterns |
| `auditLogs` | Change tracking | action, entityType, changes (before/after) |

---

## CODING CONVENTIONS (Follow These Exactly)

### Database (Drizzle)
- All tables use `mysqlTable()` from `drizzle-orm/mysql-core`
- Every table has `tenantId: int("tenantId").notNull()` for multi-tenant isolation
- JSON fields use `json("field").$type<TypeHere>()` for type inference
- Indexes follow pattern: `fieldNameIdx: index("tableName_field_idx").on(table.field)`
- Export both `type TableName = typeof table.$inferSelect` and `type InsertTableName = typeof table.$inferInsert`
- Run `pnpm db:push` after schema changes to generate and run migrations

### API (tRPC)
- All routers in `server/routers.ts`, organized as sub-routers merged into `appRouter`
- Use `protectedProcedure` for authenticated endpoints, `publicProcedure` for public
- Input validation with Zod: `.input(z.object({ ... }))`
- Database calls go through `server/db.ts` functions, not inline queries
- Error handling with `throw new TRPCError({ code: 'NOT_FOUND', message: '...' })`

### Frontend (React)
- Pages in `client/src/pages/`, components in `client/src/components/`
- Use shadcn/ui components from `@/components/ui/` (Card, Button, Dialog, Tabs, etc.)
- Data fetching with tRPC hooks: `trpc.routerName.procedureName.useQuery()`
- Mutations: `trpc.routerName.procedureName.useMutation()`
- Routing with wouter: `<Route path="/path" component={Page} />`
- New routes must be added to `App.tsx` inside the `<Switch>` wrapped in `<DashboardLayout>`
- Tailwind for styling, no inline styles, no CSS modules
- Use `lucide-react` for icons
- Use `recharts` for charts
- Use `framer-motion` for animations
- Use `sonner` for toast notifications

### File Organization
- New database query functions → add to `server/db.ts`
- New API endpoints → add as sub-router in `server/routers.ts`
- New pages → create in `client/src/pages/`, add route in `App.tsx`
- Shared types → export from `drizzle/schema.ts`, auto-available via `shared/types.ts`
- Constants → add to `shared/constants.ts`

---

## PHASE 1: Evergreen Fund Governance Layer

### 1.1 — New Schema Tables (add to `drizzle/schema.ts`)

Add these tables AFTER the existing `auditLogs` table:

```typescript
// ============================================================================
// GOVERNANCE CYCLES & FEEDBACK GRAPH
// ============================================================================

// Configurable feedback types — extensible for 360 feedback
export const feedbackTypes = mysqlTable("feedbackTypes", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  key: varchar("key", { length: 50 }).notNull(),          // 'self', 'chairman', 'md', 'peer', 'upward'
  label: varchar("label", { length: 100 }).notNull(),      // 'Self Assessment', 'Chairman Assessment'
  description: text("description"),
  visibilityRule: mysqlEnum("visibilityRule", ["IMMEDIATE", "AFTER_ALL_SUBMIT", "AFTER_DEADLINE", "ADMIN_RELEASE"]).default("AFTER_ALL_SUBMIT"),
  isBlind: boolean("isBlind").default(false),              // Hide assessor identity from target
  revealTrigger: varchar("revealTrigger", { length: 100 }), // e.g., 'after_self_and_chairman_submit'
  cadence: mysqlEnum("cadence", ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).default("MONTHLY"),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("feedbackTypes_tenantId_idx").on(table.tenantId),
  keyIdx: index("feedbackTypes_key_idx").on(table.key),
}));

// Monthly/quarterly assessment cycles
export const governanceCycles = mysqlTable("governanceCycles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  month: varchar("month", { length: 7 }).notNull(),        // '2026-04'
  status: mysqlEnum("status", ["DRAFT", "OPEN", "CLOSED", "REVEALED"]).default("DRAFT"),
  openDate: timestamp("openDate"),
  deadlineDate: timestamp("deadlineDate"),
  revealDate: timestamp("revealDate"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("governanceCycles_tenantId_idx").on(table.tenantId),
  monthIdx: index("governanceCycles_month_idx").on(table.month),
  statusIdx: index("governanceCycles_status_idx").on(table.status),
}));

// Generic assessment table — handles self, chairman, peer, 360, all types
export const governanceAssessments = mysqlTable("governanceAssessments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  cycleId: int("cycleId").notNull(),
  assessorPersonId: int("assessorPersonId").notNull(),
  targetType: mysqlEnum("targetType", ["ROLE", "COMPANY", "CHAIN"]).notNull(),
  targetId: int("targetId").notNull(),                      // references roles.id or orgUnits.id
  dimensionKey: varchar("dimensionKey", { length: 100 }).notNull(), // mandate key or company dimension
  feedbackTypeId: int("feedbackTypeId").notNull(),
  score: int("score"),                                       // 1-10
  rag: mysqlEnum("rag", ["RED", "AMBER", "GREEN"]),
  note: text("note"),                                        // Commentary on this rating
  confidenceNote: text("confidenceNote"),                    // One-line justification
  submittedAt: timestamp("submittedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("govAssessments_tenantId_idx").on(table.tenantId),
  cycleIdx: index("govAssessments_cycleId_idx").on(table.cycleId),
  assessorIdx: index("govAssessments_assessorPersonId_idx").on(table.assessorPersonId),
  targetIdx: index("govAssessments_targetType_targetId_idx").on(table.targetType, table.targetId),
  feedbackTypeIdx: index("govAssessments_feedbackTypeId_idx").on(table.feedbackTypeId),
}));

// What each user needs to assess this cycle
export const assessmentAssignments = mysqlTable("assessmentAssignments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  cycleId: int("cycleId").notNull(),
  assessorPersonId: int("assessorPersonId").notNull(),
  targetType: mysqlEnum("targetType", ["ROLE", "COMPANY", "CHAIN"]).notNull(),
  targetId: int("targetId").notNull(),
  feedbackTypeId: int("feedbackTypeId").notNull(),
  status: mysqlEnum("status", ["PENDING", "IN_PROGRESS", "SUBMITTED", "OVERDUE"]).default("PENDING"),
  dueDate: timestamp("dueDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("assessAssign_tenantId_idx").on(table.tenantId),
  cycleIdx: index("assessAssign_cycleId_idx").on(table.cycleId),
  assessorIdx: index("assessAssign_assessorPersonId_idx").on(table.assessorPersonId),
  statusIdx: index("assessAssign_status_idx").on(table.status),
}));

// ============================================================================
// MANDATE JOURNALS & REFLECTIONS
// ============================================================================

// Per-mandate monthly journal entries (Captain's Log)
export const mandateJournals = mysqlTable("mandateJournals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  cycleId: int("cycleId").notNull(),
  roleId: int("roleId"),                                    // For CXO mandates
  orgUnitId: int("orgUnitId"),                              // For company dimensions
  dimensionKey: varchar("dimensionKey", { length: 100 }).notNull(),
  logText: text("logText"),                                  // "What I did this month"
  planText: text("planText"),                                // "What I plan next month"
  planItems: json("planItems").$type<Array<{ item: string; completedNextMonth: boolean | null }>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("mandateJournals_tenantId_idx").on(table.tenantId),
  personIdx: index("mandateJournals_personId_idx").on(table.personId),
  cycleIdx: index("mandateJournals_cycleId_idx").on(table.cycleId),
  roleIdx: index("mandateJournals_roleId_idx").on(table.roleId),
}));

// CEO's monthly structured company reflection
export const companyReflections = mysqlTable("companyReflections", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  ceoPersonId: int("ceoPersonId").notNull(),
  orgUnitId: int("orgUnitId").notNull(),                    // The company
  cycleId: int("cycleId").notNull(),
  wentWell: json("wentWell").$type<string[]>(),
  didntGoWell: json("didntGoWell").$type<string[]>(),
  risks: json("risks").$type<string[]>(),
  needsFromFund: json("needsFromFund").$type<string[]>(),
  forwardCommitments: json("forwardCommitments").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("companyReflections_tenantId_idx").on(table.tenantId),
  ceoIdx: index("companyReflections_ceoPersonId_idx").on(table.ceoPersonId),
  cycleIdx: index("companyReflections_cycleId_idx").on(table.cycleId),
  orgUnitIdx: index("companyReflections_orgUnitId_idx").on(table.orgUnitId),
}));

// Chairman's forward-looking guidance notes
export const chairmanGuidance = mysqlTable("chairmanGuidance", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  cycleId: int("cycleId").notNull(),
  chairmanPersonId: int("chairmanPersonId").notNull(),
  targetType: mysqlEnum("targetType", ["ROLE", "COMPANY"]).notNull(),
  targetId: int("targetId").notNull(),
  dimensionKey: varchar("dimensionKey", { length: 100 }),
  guidanceText: text("guidanceText").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("chairmanGuidance_tenantId_idx").on(table.tenantId),
  cycleIdx: index("chairmanGuidance_cycleId_idx").on(table.cycleId),
  targetIdx: index("chairmanGuidance_targetType_targetId_idx").on(table.targetType, table.targetId),
}));

// ============================================================================
// DEPENDENCY CHAINS
// ============================================================================

export const dependencyChains = mysqlTable("dependencyChains", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  description: text("description"),
  nodeRoleIds: json("nodeRoleIds").$type<number[]>(),       // Ordered list of role IDs in the chain
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("dependencyChains_tenantId_idx").on(table.tenantId),
}));

// ============================================================================
// AI INSIGHTS
// ============================================================================

export const aiInsights = mysqlTable("aiInsights", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  cycleId: int("cycleId"),
  insightType: mysqlEnum("insightType", [
    "PERCEPTION_GAP", "COMMITMENT_TRACKING", "ENGAGEMENT_PATTERN",
    "CHAIN_RISK", "FINANCIAL_MISMATCH", "TREND_ALERT", "360_SYNTHESIS"
  ]).notNull(),
  targetType: mysqlEnum("targetType", ["ROLE", "COMPANY", "CHAIN", "FUND"]),
  targetId: int("targetId"),
  insightText: text("insightText").notNull(),
  severity: mysqlEnum("severity", ["INFO", "WARNING", "CRITICAL"]).default("INFO"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("aiInsights_tenantId_idx").on(table.tenantId),
  cycleIdx: index("aiInsights_cycleId_idx").on(table.cycleId),
  typeIdx: index("aiInsights_insightType_idx").on(table.insightType),
}));
```

After adding tables, export the types and run `pnpm db:push`.

### 1.2 — Seed the Evergreen Fund Data

Create `server/seed-evergreen.ts` to populate the tenant with the fund's specific structure:

**13 CXO Roles** (add as `roles` entries with mandates in `successMetrics` JSON):
- Executive Chairman (Gautham Pai) — 7 mandates, roleType: CHAIRMAN
- Managing Director (Abhay Anant Gupte) — 7 mandates, roleType: GROUP_CEO
- Chief of Staff (Anand Kudigrama) — 8 mandates, roleType: CXO
- CFO (Sandeep P. Chadaga) — 11 mandates, roleType: CXO
- Strategic Finance (Mayank Bhotika) — 9 mandates, roleType: CXO
- CRO (Naveen V. Saldanha) — 7 mandates, roleType: CXO
- Chief Digital (Arun Bhaskar) — 6 mandates, roleType: CXO
- CBDO (Rajesh Shet) — 6 mandates, roleType: CXO
- Head of Strategy (TBA) — 7 mandates, roleType: CXO
- CHRO (Pramod N. Fernandes) — 9 mandates, roleType: CXO
- Corp Affairs (Sagar) — 5 mandates, roleType: CXO
- Legal (Hardur M. Dattatri) — 7 mandates, roleType: CXO
- Portfolio CEOs — 13 entries, roleType: CEO

**13 Portfolio Companies** (add as `orgUnits` with type PORTFOLIO_COMPANY):
- MPI (Cards & Identity) — FY27 Rev ₹1800Cr, CEO: K Girish Kini, stage: GROWTH
- Goose Creek (Candles & Fragrance) — FY27 Rev ₹935Cr, stage: MATURE
- MGPS (Printing & Publishing) — FY27 Rev ₹590Cr, CEO: Shashi Ranjan, stage: GROWTH
- Primacy (Packaging) — FY27 Rev ₹600Cr, CEO: Raghavendra Rao, stage: GROWTH
- Westtek (Inks & Chemicals) — FY27 Rev ₹90Cr, stage: STARTUP
- Ascense (Candles US) — FY27 Rev ₹130Cr, stage: TURNAROUND
- MBS (BFSI BPO) — FY27 Rev ₹265Cr, CEO: Vishal Jain, stage: GROWTH
- AdSyndicate (Advertising) — FY27 Rev ₹175Cr, CEO: Dwijendra Acharya, stage: GROWTH
- MMNL (Media) — FY27 Rev ₹200Cr, CEO: Vinod Kumar, stage: MATURE
- MFPL (Gold Loan) — FY27 Rev ₹125Cr, CEO: Puja Singh, stage: STARTUP
- MDS (Creative Production) — FY27 Rev ₹96Cr, CEO: Guruprasad Kamath, stage: GROWTH
- EKAM (D2C Fragrance) — FY27 Rev ₹15Cr, CEO: Aarti Koya, stage: STARTUP
- CrossFraud (RegTech) — FY27 Rev ₹13Cr, CEO: Dhiren, stage: STARTUP

**5 Dependency Chains** (add as `dependencyChains` entries):
- Financial Truth (CFO → StratFin → CRO → MD → Chairman)
- Growth Engine (Strategy → CBDO → StratFin → MD → CEOs)
- Governance Shield (CRO → CFO → Legal → CorpAffairs → Chairman)
- Talent Loop (CHRO → MD → CEOs → Chairman)
- Intelligence Nervous System (Digital → CFO → Strategy → MD → Chairman)

**3 Initial Feedback Types** (add as `feedbackTypes`):
- `self` — Self Assessment, visibility: IMMEDIATE, blind: false, monthly
- `chairman` — Chairman Assessment, visibility: AFTER_ALL_SUBMIT, blind: false, monthly
- `md` — MD Assessment, visibility: AFTER_ALL_SUBMIT, blind: false, monthly

**FY27 Budget Data** — seed as `metrics` and `metricValues` per company for Revenue, EBITDA, PBT.

### 1.3 — New Pages to Build

#### `/my-bridge` — CXO Personal Workspace ("My Bridge")

This is the heart of the app for every CXO. When they log in, they land here.

**Layout:**
- **Top bar**: Person name, role title, tagline, signature KPI with actual vs target
- **Center**: Mandate cards as a vertical list. Each card has 4 expandable layers:
  - **Captain's Log** (journal): Rich text entry — "What I did this month toward this mandate"
  - **Forward Plan**: 1-3 specific commitments for next month. System shows last month's plan greyed alongside this month's log for plan-to-log tracking
  - **Self-Rating**: 1-10 slider with RAG auto-calculation
  - **Chairman's View**: Revealed only after both self and chairman submit. Shows chairman's score + gap + guidance note
- **Sidebar**: "My Chains" — which dependency chains this person belongs to, with current health
- **Bottom**: "Submit Month" button that locks all entries

**Data flow:**
- Reads from: `mandateJournals`, `governanceAssessments` (where assessorPersonId = me AND feedbackType = 'self'), `governanceCycles`
- Writes to: `mandateJournals` (log + plan), `governanceAssessments` (self-rating)
- Chairman's view reads: `governanceAssessments` (where feedbackType = 'chairman' AND targetId = my role)

#### `/my-island` — CEO Personal Workspace ("My Island")

Same philosophy as My Bridge, but for company dimensions instead of role mandates.

**Layout:**
- **Top**: Company name, sector, stage, CEO name, financial badges (FY27 Rev, EBITDA%, YoY Growth)
- **Center**: Dimension cards (e.g., Revenue Growth, Margin, Operations, Team) with same 4-layer system
- **Below dimensions**: Monthly Company Reflection — structured form with 5 fields:
  - What went well (2-3 points)
  - What didn't go well (2-3 points)
  - Key risks and concerns
  - What I need from the fund
  - Forward commitments (top 3)
- **Sidebar**: Financial actuals entry (quarterly Rev + EBITDA) with variance against budget
- **Bottom**: Submit button

**Data flow:**
- Reads/writes: `mandateJournals` (with orgUnitId instead of roleId), `governanceAssessments`, `companyReflections`, `metricValues`

#### `/chairman` — Enhanced Chairman Dashboard

Extend the existing `Analytics.tsx` or create a new chairman-specific dashboard:

- **Pending Reviews panel**: Which CXOs/CEOs have submitted reflections+ratings, who hasn't (from `assessmentAssignments`)
- **Top Perception Gaps**: 5 largest gaps this month between self and chairman scores (from `governanceAssessments`)
- **Unread Reflections**: CEO monthly reflections the Chairman hasn't opened yet
- **Zone Health**: Hull (critical roles avg) / Deck (operational roles avg) / Mast (strategic roles avg)
- **Fund Vitality Score**: Weighted overall health metric
- **Chain Health**: 5 dependency chains with weakest-link scores
- **Financial Cockpit**: Sortable table of all 13 companies — FY27 Budget vs YTD Actuals with variance

#### `/financial-cockpit` — Financial Cockpit Page

Sortable table with:
- All 13 companies as rows
- Columns: FY26 Rev, FY27 Budget, YoY%, EBITDA, EBITDA%, PBT, Q1/Q2/Q3/Q4 Actuals (Rev + EBITDA), YTD Total, Variance%
- Color-coded variance: Green (within 5%), Amber (5-20% off), Red (>20% off)
- Group totals row at bottom
- Editable actuals cells for CEOs (their company only)
- Read-only for everyone else

#### `/360` — 360 Feedback Hub (Phase 2, but build the route now)

Placeholder page that shows:
- Current 360 cycle status (if any active)
- "360 feedback will be available when activated by the Chairman"
- Admin can configure: which feedback types are active, assignment rules, cadence

### 1.4 — Visual Design: Dark Oceanic Theme

The app currently uses a light theme. The Evergreen Fund vision demands a **dark oceanic** theme:

**Color tokens** (add to Tailwind config or CSS variables):
```
--bg-deep: #060B14
--bg-surface: #0A1628
--bg-card: #0F1D32
--glass-border: rgba(255, 255, 255, 0.08)
--teal: #00D4AA          (primary/positive)
--gold: #FFB800          (KPIs/excellence)
--red: #FF4757           (critical/Hull zone)
--amber: #FFA502         (operational/Deck zone)
--green: #2ED573         (growth/Mast zone)
--purple: #A78BFA        (people)
```

**Typography**: Playfair Display for headlines, Inter for body text (Inter is already loaded).

**Glassmorphism**: Cards should use `backdrop-filter: blur(12px)` with semi-transparent backgrounds.

**Ship metaphor language throughout**:
- Zones are "Hull" / "Deck" / "Mast", not "Critical" / "Operational" / "Strategic"
- CXO workspace = "My Bridge" (the ship's command station)
- CEO workspace = "My Island" (each company is an island in the seascape)
- Login greeting: "Welcome aboard, [Name]. Your station awaits."
- Monthly cycle: "Captain's Log" for journal entries
- Forward plan: "Next Heading"

---

## PHASE 2: Perception Engine & Multi-User

### 2.1 — Blind Assessment Workflow

When a governance cycle is OPEN:
1. CXOs/CEOs can journal, plan, and self-rate (feedbackType = 'self')
2. Chairman rates independently (feedbackType = 'chairman') — does NOT see self-ratings
3. Chairman CAN read journals and reflections (they inform but don't bias)
4. When BOTH self AND chairman have submitted for a target, perception gap is calculated and revealed
5. Gap = |chairman_score - self_score| per dimension
6. Traffic light: Gap > 2 = RED flag, Gap 1-2 = AMBER, Gap < 1 = GREEN

### 2.2 — Plan-to-Log Tracking

When displaying this month's My Bridge/My Island:
- Show last month's `planText` and `planItems` alongside this month's `logText`
- Visual side-by-side: "What you planned" (greyed) | "What you logged" (active)
- For each `planItem` from last month, show a checkbox: was this addressed?
- Not automated — just makes the gap between intention and action obvious

### 2.3 — Notification Triggers

Add to the existing `notifications` system:
- "Rating cycle open" — sent to all users on Day 1
- "X days until deadline" — 7, 3, 1 day reminders
- "Chairman has completed assessment" — sent to each CXO/CEO after chairman submits their scores
- "Your perception gaps are available" — after reveal
- "You have mandates without journal entries" — weekly nudge

---

## PHASE 3: 360 Feedback

### 3.1 — Feedback Type Configuration (Admin Panel)

Add to the Admin page:
- List of feedback types (from `feedbackTypes` table)
- Toggle active/inactive
- Configure: cadence, visibility rule, blind/named, reveal trigger
- "Add Feedback Type" button for new types (e.g., 'peer', 'upward', 'cross_functional')

### 3.2 — Assignment Rules

When a 360 cycle opens:
- System generates `assessmentAssignments` based on configured rules
- Peer: each CXO assesses 3-4 assigned peers
- Upward: each CEO assesses the CXOs they interact with
- Chairman selects who assesses whom in the Admin panel

### 3.3 — 360 Results

- Aggregate scores by feedback type per target
- Blind assessments: show average score across all peer assessors, no individual identity
- Chairman sees individual responses for calibration
- Visual: radar chart showing self vs chairman vs peer average per dimension

---

## PHASE 4: AI Intelligence

### 4.1 — Enhance `server/ai-ask.ts`

Add new query types the RAG pipeline can handle:
- "Show me the biggest perception gaps this month"
- "Which CEOs have been deferring the same commitments?"
- "What's the Financial Truth chain health trend over 6 months?"
- "Compare MPI's self-assessment with chairman's assessment"

### 4.2 — Commitment Tracker

New function in `server/ai-review.ts` or new file `server/ai-commitment.ts`:
- For each person, compare last month's `planItems` with this month's `logText`
- Use AI to determine: addressed, partially addressed, deferred, not mentioned
- Flag items deferred 3+ consecutive months as "chronic deferrals"
- Surface in Chairman Dashboard

### 4.3 — AI Insights Generation

Batch process (triggered monthly after cycle closes or on-demand):
- Write insights to `aiInsights` table
- Types: perception gaps, commitment tracking, engagement patterns, chain risks, financial mismatches
- Display on Chairman Dashboard as insight cards

---

## IMPORTANT RULES

1. **Never break existing functionality.** The platform has working observation capture, AI reviews, incentive simulation, meetings, reflections, financial uploads, and more. All of this must continue working.

2. **Use the existing `assessments` table for legacy milestone/quarterly/annual reviews.** The new `governanceAssessments` table is specifically for the monthly governance cycle (self + chairman + 360). They serve different purposes and should coexist.

3. **Multi-tenant always.** Every query must filter by `tenantId`. Every new table must have `tenantId`.

4. **Type safety end-to-end.** Every new table gets exported types. Every new API endpoint gets Zod validation. Every new page uses typed tRPC hooks.

5. **Mobile responsive.** Every new page must work on mobile (< 768px). Use the existing `MobileBottomNav` component pattern.

6. **Dark theme.** All new UI uses the dark oceanic palette. Existing pages can be migrated incrementally.

7. **Ship metaphor.** Use nautical language in all UI copy: Bridge, Island, Captain's Log, Hull/Deck/Mast, station, heading, voyage.

8. **Commit frequently.** After each sub-feature (e.g., "schema added", "seed script working", "My Bridge page rendering"), commit with a clear message.

---

## EXECUTION ORDER

Start here and work through sequentially:

1. Add new tables to `drizzle/schema.ts` → run `pnpm db:push`
2. Add DB query functions to `server/db.ts`
3. Add tRPC routers for governance cycles, assessments, journals, reflections
4. Build `/my-bridge` page (CXO workspace)
5. Build `/my-island` page (CEO workspace)
6. Build `/chairman` enhanced dashboard
7. Build `/financial-cockpit` page
8. Add dark oceanic theme (CSS variables + Tailwind config)
9. Seed Evergreen Fund data (roles, companies, chains, feedback types)
10. Add perception gap calculation logic
11. Add blind assessment reveal workflow
12. Add plan-to-log tracking UI
13. Add notification triggers for governance cycle
14. Build 360 feedback configuration (Admin panel)
15. Build 360 assignment and results pages
16. Add AI commitment tracking
17. Add AI insights generation

---

*Manipal Evergreen Fund — Confidential*
