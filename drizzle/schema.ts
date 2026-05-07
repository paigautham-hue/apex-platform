import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index, unique, primaryKey } from "drizzle-orm/mysql-core";

/**
 * APEX Database Schema
 * Multi-tenant, multi-company executive performance management platform
 */

// ============================================================================
// AUTHENTICATION & USERS
// ============================================================================

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// MULTI-TENANT ARCHITECTURE
// ============================================================================

export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ============================================================================
// ORGANIZATIONAL STRUCTURE
// ============================================================================

export const orgUnits = mysqlTable("orgUnits", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["HOLDING_COMPANY", "PORTFOLIO_COMPANY", "FUNCTION", "TEAM", "SUB_BUSINESS"]).notNull(),
  parentOrgUnitId: int("parentOrgUnitId"),
  leaderPersonId: int("leaderPersonId"),
  businessType: mysqlEnum("businessType", ["GROWTH", "HARVEST", "INCUBATE"]),
  lifecycleStage: mysqlEnum("lifecycleStage", ["STARTUP", "GROWTH", "MATURE", "TURNAROUND"]),
  industrySector: text("industrySector"),
  currency: varchar("currency", { length: 10 }).default("INR"),
  currencyDisplayUnit: varchar("currencyDisplayUnit", { length: 10 }).default("Cr"),
  fiscalYearStartMonth: int("fiscalYearStartMonth").default(4),
  customMetrics: json("customMetrics").$type<Array<{ name: string; definition: string; unit: string }>>(),
  customGoalCategories: json("customGoalCategories").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("orgUnits_tenantId_idx").on(table.tenantId),
  parentIdx: index("orgUnits_parentOrgUnitId_idx").on(table.parentOrgUnitId),
}));

export const persons = mysqlTable("persons", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  photoUrl: text("photoUrl"),
  currentRoleId: int("currentRoleId"),
  hireDate: timestamp("hireDate"),
  tenure: int("tenure"),
  valuesProfile: json("valuesProfile").$type<Record<string, number>>(),
  performanceHistory: json("performanceHistory").$type<Array<any>>(),
  capabilityProfile: json("capabilityProfile").$type<Record<string, any>>(),
  hiringThesis: json("hiringThesis").$type<{
    predictedStrengths: string[];
    predictedRisks: string[];
    predictedValuesScores: Record<string, number>;
    thesisDate: string;
    thesisAuthorId: number;
  }>(),
  dataSufficiencyLevel: int("dataSufficiencyLevel").default(0),
  evidenceCount: int("evidenceCount").default(0),
  sourceCount: int("sourceCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("persons_tenantId_idx").on(table.tenantId),
  userIdx: index("persons_userId_idx").on(table.userId),
  emailIdx: index("persons_email_idx").on(table.email),
}));

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  personId: int("personId").notNull(),
  orgUnitId: int("orgUnitId").notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate"),
  reportsToRoleId: int("reportsToRoleId"),
  scopeDescription: text("scopeDescription"),
  rolePurpose: text("rolePurpose"),
  keyResponsibilities: json("keyResponsibilities").$type<string[]>(),
  successMetrics: json("successMetrics").$type<string[]>(),
  roleType: mysqlEnum("roleType", ["CEO", "CXO", "CXO_PLUS_ONE", "CHRO", "BOARD_MEMBER", "CHAIRMAN", "GROUP_CEO", "GROUP_CHRO"]).notNull(),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("roles_tenantId_idx").on(table.tenantId),
  personIdx: index("roles_personId_idx").on(table.personId),
  orgUnitIdx: index("roles_orgUnitId_idx").on(table.orgUnitId),
  activeIdx: index("roles_isActive_idx").on(table.isActive),
}));

// ============================================================================
// GOALS & METRICS
// ============================================================================

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["PORTFOLIO_STRATEGY", "BUSINESS_PLAN", "ANNUAL_OPERATING_PLAN", "FUNCTION_PLAN", "OKR", "INDIVIDUAL_GOAL"]).notNull(),
  ownerPersonId: int("ownerPersonId").notNull(),
  orgUnitId: int("orgUnitId").notNull(),
  parentPlanId: int("parentPlanId"),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  category: mysqlEnum("category", ["FINANCIAL", "STRATEGIC", "OPERATIONAL", "SUSTAINABILITY", "LEADERSHIP", "GOVERNANCE"]).notNull(),
  weightPercentage: decimal("weightPercentage", { precision: 5, scale: 2 }),
  targets: json("targets").$type<Record<string, any>>(),
  assumptions: json("assumptions").$type<string[]>(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).default("DRAFT"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("plans_tenantId_idx").on(table.tenantId),
  ownerIdx: index("plans_ownerPersonId_idx").on(table.ownerPersonId),
  orgUnitIdx: index("plans_orgUnitId_idx").on(table.orgUnitId),
  statusIdx: index("plans_status_idx").on(table.status),
}));

export const metrics = mysqlTable("metrics", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  definition: text("definition"),
  formula: text("formula"),
  planId: int("planId").notNull(),
  targetValue: decimal("targetValue", { precision: 15, scale: 2 }),
  updateCadence: mysqlEnum("updateCadence", ["MONTHLY", "QUARTERLY", "ANNUAL"]).notNull(),
  dataSource: varchar("dataSource", { length: 255 }),
  ownerPersonId: int("ownerPersonId"),
  driverTreePosition: json("driverTreePosition").$type<{ parentMetricIds: number[]; childMetricIds: number[] }>(),
  isNegativeTarget: boolean("isNegativeTarget").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("metrics_tenantId_idx").on(table.tenantId),
  planIdx: index("metrics_planId_idx").on(table.planId),
}));

export const metricValues = mysqlTable("metricValues", {
  id: int("id").autoincrement().primaryKey(),
  metricId: int("metricId").notNull(),
  periodDate: timestamp("periodDate").notNull(),
  periodType: mysqlEnum("periodType", ["MONTHLY", "QUARTERLY", "ANNUAL", "CUMULATIVE_YTD"]).notNull(),
  actualValue: decimal("actualValue", { precision: 15, scale: 2 }).notNull(),
  targetValue: decimal("targetValue", { precision: 15, scale: 2 }),
  sourceUploadId: int("sourceUploadId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  metricIdx: index("metricValues_metricId_idx").on(table.metricId),
  periodIdx: index("metricValues_periodDate_idx").on(table.periodDate),
}));

// ============================================================================
// EVIDENCE & OBSERVATIONS
// ============================================================================

export const evidence = mysqlTable("evidence", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  type: mysqlEnum("type", ["SCREENSHOT", "EMAIL", "DOCUMENT", "VOICE_NOTE", "ARTICLE", "MEETING_NOTE", "FINANCIAL_REPORT"]).notNull(),
  contentText: text("contentText"),
  fileUrl: text("fileUrl"),
  uploadDate: timestamp("uploadDate").defaultNow().notNull(),
  uploaderPersonId: int("uploaderPersonId").notNull(),
  taggedPersonIds: json("taggedPersonIds").$type<number[]>(),
  sourceType: mysqlEnum("sourceType", ["SELF_OBSERVATION", "PEER_FEEDBACK", "CUSTOMER_EMAIL", "MEETING_NOTE", "ARTICLE_SHARE", "KPI_DATA", "FINANCIAL_UPLOAD"]).notNull(),
  direction: mysqlEnum("direction", ["POSITIVE", "NEGATIVE", "MIXED", "NEUTRAL"]),
  valueTags: json("valueTags").$type<string[]>(),
  goalLinks: json("goalLinks").$type<number[]>(),
  visibility: mysqlEnum("visibility", ["DRAFT", "MANAGER_REVIEW", "OFFICIAL"]).default("DRAFT"),
  credibilityTier: int("credibilityTier").default(3),
  isCoolDown: boolean("isCoolDown").default(false),
  coolDownExpiresAt: timestamp("coolDownExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("evidence_tenantId_idx").on(table.tenantId),
  uploaderIdx: index("evidence_uploaderPersonId_idx").on(table.uploaderPersonId),
  uploadDateIdx: index("evidence_uploadDate_idx").on(table.uploadDate),
  visibilityIdx: index("evidence_visibility_idx").on(table.visibility),
}));

export const observations = mysqlTable("observations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  observerPersonId: int("observerPersonId").notNull(),
  subjectPersonId: int("subjectPersonId").notNull(),
  text: text("text").notNull(),
  voiceTranscript: text("voiceTranscript"),
  direction: mysqlEnum("direction", ["POSITIVE", "NEEDS_IMPROVEMENT", "NEUTRAL"]).notNull(),
  valueTags: json("valueTags").$type<string[]>(),
  performanceTags: json("performanceTags").$type<string[]>(),
  templateUsed: varchar("templateUsed", { length: 100 }),
  source: mysqlEnum("source", ["QUICK_NOTE", "VOICE_MEMO", "WEEKLY_PULSE", "MEETING_LOGGER", "TEMPLATE"]).notNull(),
  meetingId: int("meetingId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("observations_tenantId_idx").on(table.tenantId),
  observerIdx: index("observations_observerPersonId_idx").on(table.observerPersonId),
  subjectIdx: index("observations_subjectPersonId_idx").on(table.subjectPersonId),
  createdAtIdx: index("observations_createdAt_idx").on(table.createdAt),
}));

export const selfReflections = mysqlTable("selfReflections", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  type: mysqlEnum("type", ["ACHIEVEMENT", "LEARNING", "CHALLENGE_OVERCOME", "CROSS_FUNCTIONAL", "FEEDBACK_RECEIVED", "DEVELOPMENT_ACTIVITY"]).notNull(),
  text: text("text").notNull(),
  attachments: json("attachments").$type<string[]>(),
  autoTags: json("autoTags").$type<{ valueTags: string[]; performanceTags: string[] }>(),
  corroborationStatus: mysqlEnum("corroborationStatus", ["PENDING", "CORROBORATED", "SELF_ONLY"]).default("PENDING"),
  corroboratedBy: json("corroboratedBy").$type<{ evidenceIds: number[]; observationIds: number[] }>(),
  visibility: mysqlEnum("visibility", ["PRIVATE_FOREVER", "PRIVATE_DRAFT", "SHARED_WITH_MANAGER", "INCLUDED_IN_REVIEW"]).default("PRIVATE_DRAFT"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("selfReflections_tenantId_idx").on(table.tenantId),
  personIdx: index("selfReflections_personId_idx").on(table.personId),
  visibilityIdx: index("selfReflections_visibility_idx").on(table.visibility),
}));

// ============================================================================
// MEMORY & AI INTELLIGENCE
// ============================================================================

export const memories = mysqlTable("memories", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  claimText: text("claimText").notNull(),
  evidenceIds: json("evidenceIds").$type<number[]>(),
  personId: int("personId").notNull(),
  confidenceScore: decimal("confidenceScore", { precision: 3, scale: 2 }),
  validityScope: json("validityScope").$type<{ role?: string; project?: string; period?: string }>(),
  expiryTriggers: json("expiryTriggers").$type<string[]>(),
  verificationStatus: mysqlEnum("verificationStatus", ["VERIFIED", "HISTORICAL", "NEEDS_REVIEW"]).default("VERIFIED"),
  valueTags: json("valueTags").$type<string[]>(),
  performanceDimensions: json("performanceDimensions").$type<string[]>(),
  embeddingVector: json("embeddingVector").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastVerifiedAt: timestamp("lastVerifiedAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("memories_tenantId_idx").on(table.tenantId),
  personIdx: index("memories_personId_idx").on(table.personId),
  verificationIdx: index("memories_verificationStatus_idx").on(table.verificationStatus),
}));

// ============================================================================
// ASSESSMENTS & REVIEWS
// ============================================================================

export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  type: mysqlEnum("type", ["MILESTONE_30", "MILESTONE_60", "MILESTONE_90", "MILESTONE_180", "MILESTONE_365", "QUARTERLY", "ANNUAL"]).notNull(),
  performanceScores: json("performanceScores").$type<Record<string, number>>(),
  valuesScores: json("valuesScores").$type<Record<string, number>>(),
  aiSignalSummary: text("aiSignalSummary"),
  humanJudgment: text("humanJudgment"),
  coverageMetrics: json("coverageMetrics").$type<{ evidenceCount: number; sourceCount: number; recency: string }>(),
  supportingMemoryIds: json("supportingMemoryIds").$type<number[]>(),
  assessorPersonId: int("assessorPersonId").notNull(),
  status: mysqlEnum("status", ["AI_DRAFT", "MANAGER_DRAFT", "UNDER_REVIEW", "CALIBRATED", "FINAL"]).default("AI_DRAFT"),
  quadrant: mysqlEnum("quadrant", ["STAR", "BRILLIANT_JERK", "HIGH_POTENTIAL", "NEEDS_DEVELOPMENT"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("assessments_tenantId_idx").on(table.tenantId),
  personIdx: index("assessments_personId_idx").on(table.personId),
  statusIdx: index("assessments_status_idx").on(table.status),
}));

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  assessmentId: int("assessmentId").notNull(),
  personId: int("personId").notNull(),
  type: mysqlEnum("type", ["MILESTONE", "QUARTERLY", "ANNUAL"]).notNull(),
  aiGeneratedDraft: text("aiGeneratedDraft"),
  managerEditedVersion: text("managerEditedVersion"),
  employeeResponse: text("employeeResponse"),
  status: mysqlEnum("status", ["DRAFT", "SHARED", "ACKNOWLEDGED", "CONTESTED", "FINAL"]).default("DRAFT"),
  fitDetermination: mysqlEnum("fitDetermination", ["STRONG_FIT", "DEVELOPING", "CONCERNS", "NOT_FIT"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("reviews_tenantId_idx").on(table.tenantId),
  assessmentIdx: index("reviews_assessmentId_idx").on(table.assessmentId),
  personIdx: index("reviews_personId_idx").on(table.personId),
  statusIdx: index("reviews_status_idx").on(table.status),
}));

// ============================================================================
// MEETINGS & 1:1s
// ============================================================================

export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  managerPersonId: int("managerPersonId").notNull(),
  subjectPersonId: int("subjectPersonId").notNull(),
  startedAt: timestamp("startedAt").notNull(),
  endedAt: timestamp("endedAt"),
  type: mysqlEnum("type", ["ONE_ON_ONE", "TEAM", "REVIEW", "CALIBRATION"]).notNull(),
  prepCardViewed: boolean("prepCardViewed").default(false),
  postMeetingObservationId: int("postMeetingObservationId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("meetings_tenantId_idx").on(table.tenantId),
  managerIdx: index("meetings_managerPersonId_idx").on(table.managerPersonId),
  subjectIdx: index("meetings_subjectPersonId_idx").on(table.subjectPersonId),
}));

// ============================================================================
// INCENTIVES
// ============================================================================

export const incentiveConfigs = mysqlTable("incentiveConfigs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  orgUnitId: int("orgUnitId").notNull(),
  fiscalYear: varchar("fiscalYear", { length: 20 }).notNull(),
  businessType: mysqlEnum("businessType", ["GROWTH", "HARVEST", "INCUBATE"]).notNull(),
  eligibilityThreshold: json("eligibilityThreshold").$type<{ metric: string; value: string }>(),
  financialWeight: decimal("financialWeight", { precision: 3, scale: 2 }).default("0.60"),
  nonFinancialWeight: decimal("nonFinancialWeight", { precision: 3, scale: 2 }).default("0.40"),
  financialMetricWeights: json("financialMetricWeights").$type<Record<string, number>>(),
  nonFinancialSplits: json("nonFinancialSplits").$type<Record<string, number>>(),
  slabStructure: json("slabStructure").$type<Array<{ minPct: number; maxPct: number; payoutPct: number }>>(),
  stretchTarget: json("stretchTarget").$type<{ metric: string; targetValue: number; payoutMultiplier: number }>(),
  ofcfFormula: text("ofcfFormula"),
  negativeTargetMethod: mysqlEnum("negativeTargetMethod", ["IMPROVEMENT_RATIO", "ABSOLUTE_DELTA", "CUSTOM"]).default("IMPROVEMENT_RATIO"),
  cxoCascadeOverrides: json("cxoCascadeOverrides").$type<Record<string, Record<string, number>>>(),
  status: mysqlEnum("status", ["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("incentiveConfigs_tenantId_idx").on(table.tenantId),
  orgUnitIdx: index("incentiveConfigs_orgUnitId_idx").on(table.orgUnitId),
  fiscalYearIdx: index("incentiveConfigs_fiscalYear_idx").on(table.fiscalYear),
}));

export const incentiveComputations = mysqlTable("incentiveComputations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  fiscalYear: varchar("fiscalYear", { length: 20 }).notNull(),
  period: mysqlEnum("period", ["Q1", "Q2", "Q3", "Q4", "ANNUAL"]).notNull(),
  configId: int("configId").notNull(),
  financialActuals: json("financialActuals").$type<Record<string, number>>(),
  achievementPercentages: json("achievementPercentages").$type<Record<string, number>>(),
  slabPayouts: json("slabPayouts").$type<Record<string, number>>(),
  financialWeightedPayout: decimal("financialWeightedPayout", { precision: 5, scale: 2 }),
  nonFinancialScore: decimal("nonFinancialScore", { precision: 5, scale: 2 }),
  nonFinancialWeightedPayout: decimal("nonFinancialWeightedPayout", { precision: 5, scale: 2 }),
  totalWeightedPayoutPercentage: decimal("totalWeightedPayoutPercentage", { precision: 5, scale: 2 }),
  totalProjectedPayout: decimal("totalProjectedPayout", { precision: 15, scale: 2 }),
  status: mysqlEnum("status", ["PROJECTED", "PRELIMINARY", "BOARD_APPROVED", "FINAL"]).default("PROJECTED"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("incentiveComputations_tenantId_idx").on(table.tenantId),
  personIdx: index("incentiveComputations_personId_idx").on(table.personId),
  fiscalYearIdx: index("incentiveComputations_fiscalYear_idx").on(table.fiscalYear),
}));

// ============================================================================
// CALIBRATION
// ============================================================================

export const calibrationSessions = mysqlTable("calibrationSessions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  orgUnitId: int("orgUnitId").notNull(),
  period: varchar("period", { length: 50 }).notNull(),
  participants: json("participants").$type<number[]>(),
  status: mysqlEnum("status", ["ASYNC_REVIEW", "DISAGREEMENTS_IDENTIFIED", "LIVE_SESSION", "COMPLETED"]).default("ASYNC_REVIEW"),
  assessmentsReviewed: json("assessmentsReviewed").$type<number[]>(),
  changesLog: json("changesLog").$type<Array<{ personId: number; before: any; after: any; rationale: string }>>(),
  asyncDeadline: timestamp("asyncDeadline"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("calibrationSessions_tenantId_idx").on(table.tenantId),
  orgUnitIdx: index("calibrationSessions_orgUnitId_idx").on(table.orgUnitId),
  statusIdx: index("calibrationSessions_status_idx").on(table.status),
}));

// ============================================================================
// DECISIONS
// ============================================================================

export const decisions = mysqlTable("decisions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  ownerPersonId: int("ownerPersonId").notNull(),
  orgUnitId: int("orgUnitId"),
  decisionText: text("decisionText").notNull(),
  assumptions: json("assumptions").$type<string[]>(),
  expectedOutcome: text("expectedOutcome"),
  risksIdentified: json("risksIdentified").$type<string[]>(),
  reviewDate: timestamp("reviewDate"),
  retrospectiveText: text("retrospectiveText"),
  outcomeAssessment: mysqlEnum("outcomeAssessment", ["BETTER_THAN_EXPECTED", "AS_EXPECTED", "WORSE_THAN_EXPECTED", "PENDING"]).default("PENDING"),
  linkedMetricIds: json("linkedMetricIds").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("decisions_tenantId_idx").on(table.tenantId),
  ownerIdx: index("decisions_ownerPersonId_idx").on(table.ownerPersonId),
}));

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  type: mysqlEnum("type", ["PRIORITY_ZERO", "INSIGHT", "REMINDER", "MILESTONE", "PULSE_CHECK", "ACHIEVEMENT_SUGGESTION", "CYCLE_OPEN", "CYCLE_DEADLINE", "CYCLE_REVEAL", "PERCEPTION_GAP", "MEETING_PREP", "DAILY_FOCUS"]).notNull(),
  // Tier: digest = bundled into 1 daily summary; instant = push immediately; quiet = only in-app
  tier: mysqlEnum("tier", ["INSTANT", "DIGEST", "QUIET"]).default("DIGEST"),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  actionUrl: text("actionUrl"),
  isRead: boolean("isRead").default(false),
  // For digest tier: when bundled, what date was it included in
  digestedOn: varchar("digestedOn", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("notifications_tenantId_idx").on(table.tenantId),
  personIdx: index("notifications_personId_idx").on(table.personId),
  isReadIdx: index("notifications_isRead_idx").on(table.isRead),
  tierIdx: index("notifications_tier_idx").on(table.tier),
}));

// ============================================================================
// FINANCIAL UPLOADS
// ============================================================================

export const financialUploads = mysqlTable("financialUploads", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  orgUnitId: int("orgUnitId").notNull(),
  uploaderPersonId: int("uploaderPersonId").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileHash: varchar("fileHash", { length: 64 }).notNull(),
  periodDate: timestamp("periodDate").notNull(),
  extractedData: json("extractedData").$type<Record<string, any>>(),
  confidenceScores: json("confidenceScores").$type<Record<string, number>>(),
  templateId: int("templateId"),
  status: mysqlEnum("status", ["PENDING", "EXTRACTED", "CONFIRMED", "REJECTED"]).default("PENDING"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("financialUploads_tenantId_idx").on(table.tenantId),
  orgUnitIdx: index("financialUploads_orgUnitId_idx").on(table.orgUnitId),
  periodIdx: index("financialUploads_periodDate_idx").on(table.periodDate),
  hashIdx: index("financialUploads_fileHash_idx").on(table.fileHash),
}));

export const financialTemplates = mysqlTable("financialTemplates", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  orgUnitId: int("orgUnitId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  fileType: mysqlEnum("fileType", ["EXCEL", "POWERPOINT", "PDF"]).notNull(),
  extractionRules: json("extractionRules").$type<Record<string, any>>(),
  learnedPatterns: json("learnedPatterns").$type<Record<string, any>>(),
  successRate: decimal("successRate", { precision: 5, scale: 2 }),
  usageCount: int("usageCount").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("financialTemplates_tenantId_idx").on(table.tenantId),
  orgUnitIdx: index("financialTemplates_orgUnitId_idx").on(table.orgUnitId),
}));

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: int("entityId").notNull(),
  changes: json("changes").$type<{ before: any; after: any }>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("auditLogs_tenantId_idx").on(table.tenantId),
  userIdx: index("auditLogs_userId_idx").on(table.userId),
  entityIdx: index("auditLogs_entityType_entityId_idx").on(table.entityType, table.entityId),
  createdAtIdx: index("auditLogs_createdAt_idx").on(table.createdAt),
}));

// ============================================================================
// GOVERNANCE CYCLES & FEEDBACK GRAPH
// ============================================================================

// Configurable feedback types — extensible for 360 feedback
export const feedbackTypes = mysqlTable("feedbackTypes", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  key: varchar("key", { length: 50 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  description: text("description"),
  visibilityRule: mysqlEnum("visibilityRule", ["IMMEDIATE", "AFTER_ALL_SUBMIT", "AFTER_DEADLINE", "ADMIN_RELEASE"]).default("AFTER_ALL_SUBMIT"),
  isBlind: boolean("isBlind").default(false),
  revealTrigger: varchar("revealTrigger", { length: 100 }),
  cadence: mysqlEnum("cadence", ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL"]).default("MONTHLY"),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  // Fractal: which role tiers may USE this feedback type as assessor
  // null = anyone with assignment; otherwise list like ["CHAIRMAN","GROUP_CEO","CEO","CXO"]
  assessorRoleScope: json("assessorRoleScope").$type<string[]>(),
  // Auto-reveal threshold: if X% of expected assessors submit by deadline, reveal anyway
  autoRevealThresholdPct: int("autoRevealThresholdPct").default(80),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("feedbackTypes_tenantId_idx").on(table.tenantId),
  keyIdx: index("feedbackTypes_key_idx").on(table.key),
}));

// Monthly/quarterly assessment cycles
export const governanceCycles = mysqlTable("governanceCycles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
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
  targetId: int("targetId").notNull(),
  dimensionKey: varchar("dimensionKey", { length: 100 }).notNull(),
  feedbackTypeId: int("feedbackTypeId").notNull(),
  score: int("score"),
  rag: mysqlEnum("rag", ["RED", "AMBER", "GREEN"]),
  note: text("note"),
  confidenceNote: text("confidenceNote"),
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
  roleId: int("roleId"),
  orgUnitId: int("orgUnitId"),
  dimensionKey: varchar("dimensionKey", { length: 100 }).notNull(),
  logText: text("logText"),
  planText: text("planText"),
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
  orgUnitId: int("orgUnitId").notNull(),
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
  nodeRoleIds: json("nodeRoleIds").$type<number[]>(),
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
  // Fractal scope routing
  scope: mysqlEnum("scope", ["FUND", "COMPANY", "FUNCTION", "TEAM", "INDIVIDUAL"]).default("FUND"),
  // Which person(s) should see this card surfaced — null = scope-default routing
  surfaceToPersonIds: json("surfaceToPersonIds").$type<number[]>(),
  // Drives Primary Action Card ranking (0-100)
  urgency: int("urgency").default(50),
  // Lifecycle
  status: mysqlEnum("status", ["NEW", "VIEWED", "SNOOZED", "ADDRESSED", "DISMISSED"]).default("NEW"),
  snoozedUntil: timestamp("snoozedUntil"),
  addressedAt: timestamp("addressedAt"),
  addressedByPersonId: int("addressedByPersonId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("aiInsights_tenantId_idx").on(table.tenantId),
  cycleIdx: index("aiInsights_cycleId_idx").on(table.cycleId),
  typeIdx: index("aiInsights_insightType_idx").on(table.insightType),
  scopeIdx: index("aiInsights_scope_idx").on(table.scope),
  statusIdx: index("aiInsights_status_idx").on(table.status),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

export type OrgUnit = typeof orgUnits.$inferSelect;
export type InsertOrgUnit = typeof orgUnits.$inferInsert;

export type Person = typeof persons.$inferSelect;
export type InsertPerson = typeof persons.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = typeof metrics.$inferInsert;

export type MetricValue = typeof metricValues.$inferSelect;
export type InsertMetricValue = typeof metricValues.$inferInsert;

export type Evidence = typeof evidence.$inferSelect;
export type InsertEvidence = typeof evidence.$inferInsert;

export type Observation = typeof observations.$inferSelect;
export type InsertObservation = typeof observations.$inferInsert;

export type SelfReflection = typeof selfReflections.$inferSelect;
export type InsertSelfReflection = typeof selfReflections.$inferInsert;

export type Memory = typeof memories.$inferSelect;
export type InsertMemory = typeof memories.$inferInsert;

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = typeof meetings.$inferInsert;

export type IncentiveConfig = typeof incentiveConfigs.$inferSelect;
export type InsertIncentiveConfig = typeof incentiveConfigs.$inferInsert;

export type IncentiveComputation = typeof incentiveComputations.$inferSelect;
export type InsertIncentiveComputation = typeof incentiveComputations.$inferInsert;

export type CalibrationSession = typeof calibrationSessions.$inferSelect;
export type InsertCalibrationSession = typeof calibrationSessions.$inferInsert;

export type Decision = typeof decisions.$inferSelect;
export type InsertDecision = typeof decisions.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type FinancialUpload = typeof financialUploads.$inferSelect;
export type InsertFinancialUpload = typeof financialUploads.$inferInsert;

export type FinancialTemplate = typeof financialTemplates.$inferSelect;
export type InsertFinancialTemplate = typeof financialTemplates.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export type FeedbackType = typeof feedbackTypes.$inferSelect;
export type InsertFeedbackType = typeof feedbackTypes.$inferInsert;

export type GovernanceCycle = typeof governanceCycles.$inferSelect;
export type InsertGovernanceCycle = typeof governanceCycles.$inferInsert;

export type GovernanceAssessment = typeof governanceAssessments.$inferSelect;
export type InsertGovernanceAssessment = typeof governanceAssessments.$inferInsert;

export type AssessmentAssignment = typeof assessmentAssignments.$inferSelect;
export type InsertAssessmentAssignment = typeof assessmentAssignments.$inferInsert;

export type MandateJournal = typeof mandateJournals.$inferSelect;
export type InsertMandateJournal = typeof mandateJournals.$inferInsert;

export type CompanyReflection = typeof companyReflections.$inferSelect;
export type InsertCompanyReflection = typeof companyReflections.$inferInsert;

export type ChairmanGuidance = typeof chairmanGuidance.$inferSelect;
export type InsertChairmanGuidance = typeof chairmanGuidance.$inferInsert;

export type DependencyChain = typeof dependencyChains.$inferSelect;
export type InsertDependencyChain = typeof dependencyChains.$inferInsert;

export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = typeof aiInsights.$inferInsert;

// ============================================================================
// ACCESS CONTROL — CROSS-COMPANY GRANTS & CHALLENGES
// ============================================================================

export const accessGrants = mysqlTable("accessGrants", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  grantedByUserId: int("grantedByUserId").notNull(),
  grantedToUserId: int("grantedToUserId"),
  grantedToEmail: varchar("grantedToEmail", { length: 320 }).notNull(),
  targetOrgUnitId: int("targetOrgUnitId").notNull(),
  accessLevel: mysqlEnum("accessLevel", ["VIEW_ONLY", "VIEW_AND_COMMENT", "FULL_ACCESS"]).notNull(),
  justification: text("justification"),
  expiresAt: timestamp("expiresAt").notNull(),
  status: mysqlEnum("status", ["ACTIVE", "EXPIRED", "REVOKED"]).default("ACTIVE").notNull(),
  revokedAt: timestamp("revokedAt"),
  revokedByUserId: int("revokedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("accessGrants_tenantId_idx").on(table.tenantId),
  grantedByIdx: index("accessGrants_grantedByUserId_idx").on(table.grantedByUserId),
  statusIdx: index("accessGrants_status_idx").on(table.status),
}));

export const accessChallenges = mysqlTable("accessChallenges", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  submittedByUserId: int("submittedByUserId").notNull(),
  challengeType: mysqlEnum("challengeType", [
    "UNAUTHORIZED_ACCESS",
    "INCORRECT_VISIBILITY",
    "MISSING_ACCESS",
    "DATA_ACCURACY",
    "PRIVACY_CONCERN",
    "OTHER",
  ]).notNull(),
  description: text("description").notNull(),
  relatedGrantId: int("relatedGrantId"),
  status: mysqlEnum("status", ["PENDING", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]).default("PENDING").notNull(),
  resolution: text("resolution"),
  resolvedByUserId: int("resolvedByUserId"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("accessChallenges_tenantId_idx").on(table.tenantId),
  submittedByIdx: index("accessChallenges_submittedByUserId_idx").on(table.submittedByUserId),
  statusIdx: index("accessChallenges_status_idx").on(table.status),
}));

export type AccessGrant = typeof accessGrants.$inferSelect;
export type InsertAccessGrant = typeof accessGrants.$inferInsert;
export type AccessChallenge = typeof accessChallenges.$inferSelect;
export type InsertAccessChallenge = typeof accessChallenges.$inferInsert;

// ============================================================================
// USER PREFERENCES
// ============================================================================

export const userPreferences = mysqlTable("userPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Notification toggles
  notifyPriorityZero: boolean("notifyPriorityZero").default(true).notNull(),
  notifyInsights: boolean("notifyInsights").default(true).notNull(),
  notifyReminders: boolean("notifyReminders").default(true).notNull(),
  notifyMilestones: boolean("notifyMilestones").default(true).notNull(),
  notifyPulseCheck: boolean("notifyPulseCheck").default(true).notNull(),
  notifyAchievementSuggestions: boolean("notifyAchievementSuggestions").default(true).notNull(),
  notifyBrowserPush: boolean("notifyBrowserPush").default(false).notNull(),
  // Quiet hours
  quietHoursStart: varchar("quietHoursStart", { length: 5 }).default("22:00").notNull(),
  quietHoursEnd: varchar("quietHoursEnd", { length: 5 }).default("08:00").notNull(),
  maxNotificationsPerDay: int("maxNotificationsPerDay").default(3).notNull(),
  // Onboarding
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  // Fractal landing — auto-set by role detection but user-overridable.
  // Null = use tier-computed default (Chairman→group, leader→team, IC→me).
  defaultLandingPath: mysqlEnum("defaultLandingPath", ["me", "team", "group", "today"]),
  defaultLandingExplicit: boolean("defaultLandingExplicit").default(false).notNull(),
  // Voice & UX preferences
  voiceFirstCapture: boolean("voiceFirstCapture").default(true).notNull(),
  dailyFocusEnabled: boolean("dailyFocusEnabled").default(true).notNull(),
  weeklyPulseEnabled: boolean("weeklyPulseEnabled").default(true).notNull(),
  preferredVoiceLocale: varchar("preferredVoiceLocale", { length: 10 }).default("en-IN").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("userPreferences_userId_idx").on(table.userId),
}));

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

// ============================================================================
// TRUST LAYER — entry view audit ("who saw my journal")
// ============================================================================

export const entryViews = mysqlTable("entryViews", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  viewerPersonId: int("viewerPersonId").notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: int("entityId").notNull(),
  // The owner of the entity (so they can see who viewed)
  ownerPersonId: int("ownerPersonId").notNull(),
  viewedAt: timestamp("viewedAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("entryViews_tenantId_idx").on(table.tenantId),
  ownerIdx: index("entryViews_ownerPersonId_idx").on(table.ownerPersonId),
  entityIdx: index("entryViews_entityType_entityId_idx").on(table.entityType, table.entityId),
}));

export type EntryView = typeof entryViews.$inferSelect;
export type InsertEntryView = typeof entryViews.$inferInsert;

// ============================================================================
// RHYTHM LAYER — daily focus surfacing log
// ============================================================================

export const dailyFocusLog = mysqlTable("dailyFocusLog", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  focusDate: varchar("focusDate", { length: 10 }).notNull(),
  // The action card surfaced
  primaryActionType: varchar("primaryActionType", { length: 50 }).notNull(),
  primaryActionPayload: json("primaryActionPayload").$type<Record<string, any>>(),
  primaryActionInsightId: int("primaryActionInsightId"),
  // Engagement
  surfacedAt: timestamp("surfacedAt").defaultNow().notNull(),
  viewedAt: timestamp("viewedAt"),
  actedAt: timestamp("actedAt"),
  dismissedAt: timestamp("dismissedAt"),
}, (table) => ({
  tenantIdx: index("dailyFocusLog_tenantId_idx").on(table.tenantId),
  personIdx: index("dailyFocusLog_personId_idx").on(table.personId),
  dateIdx: index("dailyFocusLog_focusDate_idx").on(table.focusDate),
}));

export type DailyFocusLog = typeof dailyFocusLog.$inferSelect;
export type InsertDailyFocusLog = typeof dailyFocusLog.$inferInsert;

// ============================================================================
// VOICE SESSIONS — live conversation transcripts (Meridian pattern)
// ============================================================================

export const voiceSessions = mysqlTable("voiceSessions", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  sessionType: mysqlEnum("sessionType", ["JOURNAL", "PULSE", "ASSESSMENT", "ASK", "MEETING_PREP"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  durationSeconds: int("durationSeconds"),
  transcript: text("transcript"),
  summary: text("summary"),
  topicsDiscussed: json("topicsDiscussed").$type<string[]>(),
  // What the bot wrote / actions taken
  resultingEntityIds: json("resultingEntityIds").$type<Array<{ type: string; id: number }>>(),
  // Context the bot had
  scopeContext: mysqlEnum("scopeContext", ["FUND", "COMPANY", "FUNCTION", "TEAM", "INDIVIDUAL"]).default("INDIVIDUAL"),
}, (table) => ({
  tenantIdx: index("voiceSessions_tenantId_idx").on(table.tenantId),
  personIdx: index("voiceSessions_personId_idx").on(table.personId),
  typeIdx: index("voiceSessions_sessionType_idx").on(table.sessionType),
}));

export type VoiceSession = typeof voiceSessions.$inferSelect;
export type InsertVoiceSession = typeof voiceSessions.$inferInsert;

// ============================================================================
// AGENTIC MEMORY — Meridian hybrid retrieval pattern
// ============================================================================

export const agenticMemories = mysqlTable("agenticMemories", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  // Who/what this memory is about
  subjectPersonId: int("subjectPersonId"),
  subjectOrgUnitId: int("subjectOrgUnitId"),
  // Semantic scope routing
  orgScope: mysqlEnum("orgScope", ["FUND", "COMPANY", "FUNCTION", "TEAM", "INDIVIDUAL"]).default("INDIVIDUAL"),
  category: mysqlEnum("category", ["PREFERENCE", "FACT", "PATTERN", "INSIGHT", "COMMITMENT", "RELATIONSHIP"]).notNull(),
  memoryKey: varchar("memoryKey", { length: 200 }).notNull(),
  memoryValue: text("memoryValue").notNull(),
  rationale: text("rationale"),
  citations: json("citations").$type<Array<{ type: string; id: number; quote?: string }>>(),
  // Retrieval signals
  embeddingVector: json("embeddingVector").$type<number[]>(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.70").notNull(),
  // Lifecycle
  verified: boolean("verified").default(false),
  needsVerification: boolean("needsVerification").default(true),
  verifiedAt: timestamp("verifiedAt"),
  verifiedByPersonId: int("verifiedByPersonId"),
  expiresAt: timestamp("expiresAt"),
  sourceHash: varchar("sourceHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("agenticMemories_tenantId_idx").on(table.tenantId),
  subjectPersonIdx: index("agenticMemories_subjectPersonId_idx").on(table.subjectPersonId),
  subjectOrgIdx: index("agenticMemories_subjectOrgUnitId_idx").on(table.subjectOrgUnitId),
  scopeIdx: index("agenticMemories_orgScope_idx").on(table.orgScope),
  categoryIdx: index("agenticMemories_category_idx").on(table.category),
}));

export type AgenticMemory = typeof agenticMemories.$inferSelect;
export type InsertAgenticMemory = typeof agenticMemories.$inferInsert;

// ============================================================================
// AI PERSONA CONFIGS — multi-persona deliberation (Assay pattern)
// ============================================================================

export const aiPersonaConfigs = mysqlTable("aiPersonaConfigs", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  key: varchar("key", { length: 50 }).notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  description: text("description"),
  systemPrompt: text("systemPrompt").notNull(),
  // Which assessor tiers can deploy this persona
  availableForRoleTypes: json("availableForRoleTypes").$type<string[]>(),
  modelId: varchar("modelId", { length: 100 }).default("claude-opus-4-7"),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("aiPersonaConfigs_tenantId_idx").on(table.tenantId),
  keyIdx: index("aiPersonaConfigs_key_idx").on(table.key),
}));

export type AiPersonaConfig = typeof aiPersonaConfigs.$inferSelect;
export type InsertAiPersonaConfig = typeof aiPersonaConfigs.$inferInsert;

// ============================================================================
// AI DELIBERATIONS — output of multi-persona panel runs
// ============================================================================

export const aiDeliberations = mysqlTable("aiDeliberations", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  cycleId: int("cycleId"),
  targetType: mysqlEnum("targetType", ["ROLE", "COMPANY", "PERSON"]).notNull(),
  targetId: int("targetId").notNull(),
  triggeredByPersonId: int("triggeredByPersonId").notNull(),
  // Per-persona verdicts
  personaVerdicts: json("personaVerdicts").$type<Array<{ personaKey: string; verdict: string; confidence: number; cited: any[] }>>(),
  // Synthesis
  synthesis: text("synthesis"),
  recommendedActions: json("recommendedActions").$type<string[]>(),
  status: mysqlEnum("status", ["RUNNING", "COMPLETE", "FAILED"]).default("RUNNING"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  tenantIdx: index("aiDeliberations_tenantId_idx").on(table.tenantId),
  targetIdx: index("aiDeliberations_targetType_targetId_idx").on(table.targetType, table.targetId),
  triggeredByIdx: index("aiDeliberations_triggeredByPersonId_idx").on(table.triggeredByPersonId),
}));

export type AiDeliberation = typeof aiDeliberations.$inferSelect;
export type InsertAiDeliberation = typeof aiDeliberations.$inferInsert;

// ============================================================================
// CALENDAR INTEGRATION — Meridian pattern
// ============================================================================

export const calendarTokens = mysqlTable("calendarTokens", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["GOOGLE", "OUTLOOK"]).notNull(),
  email: varchar("email", { length: 320 }),
  accessToken: text("accessToken").notNull(),
  refreshToken: text("refreshToken"),
  expiresAt: timestamp("expiresAt"),
  scope: text("scope"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("calendarTokens_tenantId_idx").on(table.tenantId),
  userIdx: index("calendarTokens_userId_idx").on(table.userId),
  uniq: unique("calendarTokens_user_provider_uniq").on(table.userId, table.provider),
}));

export type CalendarToken = typeof calendarTokens.$inferSelect;
export type InsertCalendarToken = typeof calendarTokens.$inferInsert;

// Cached calendar events — drives meeting prep cards
export const calendarEvents = mysqlTable("calendarEvents", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["GOOGLE", "OUTLOOK"]).notNull(),
  externalId: varchar("externalId", { length: 255 }).notNull(),
  title: text("title"),
  description: text("description"),
  startAt: timestamp("startAt").notNull(),
  endAt: timestamp("endAt"),
  attendees: json("attendees").$type<Array<{ email: string; name?: string; personId?: number }>>(),
  // Auto-linked APEX entities
  linkedPersonIds: json("linkedPersonIds").$type<number[]>(),
  linkedMeetingId: int("linkedMeetingId"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("calendarEvents_tenantId_idx").on(table.tenantId),
  userIdx: index("calendarEvents_userId_idx").on(table.userId),
  startIdx: index("calendarEvents_startAt_idx").on(table.startAt),
  uniq: unique("calendarEvents_provider_external_uniq").on(table.provider, table.externalId),
}));

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

// ============================================================================
// SHARE LINKS — view-only board pack sharing (no account needed)
// ============================================================================

export const shareLinks = mysqlTable("shareLinks", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  resourceType: varchar("resourceType", { length: 50 }).notNull(),
  resourceId: int("resourceId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  password: varchar("password", { length: 100 }),
  viewCount: int("viewCount").default(0).notNull(),
  lastViewedAt: timestamp("lastViewedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("shareLinks_tenantId_idx").on(table.tenantId),
  tokenIdx: index("shareLinks_token_idx").on(table.token),
}));

export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = typeof shareLinks.$inferInsert;

// ============================================================================
// PACE SELF-APPRAISALS — uploaded PACE documents with extracted structured data
// ============================================================================
export const selfAppraisals = mysqlTable("selfAppraisals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fiscalYear: varchar("fiscalYear", { length: 20 }),
  // Extracted structured data from the PACE document
  extractedData: json("extractedData").$type<{
    header?: { name?: string; company?: string; designation?: string; quadrant?: string; date?: string };
    kpiRows?: Array<{
      orgUnit?: string; goalName?: string; goalObjective?: string; weightage?: string;
      employeeSelfAppraisal?: string; appraiserComments?: string;
    }>;
    financialTable?: Array<{ lineItem?: string; fy25Actual?: string; fy26Aop?: string; fy26Actual?: string; varVsAop?: string }>;
    developmentGoals?: string[];
    employeeOverallComments?: string;
    appraiserOverallComments?: string;
  }>(),
  uploadedById: int("uploadedById").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("selfAppraisals_tenantId_idx").on(table.tenantId),
  personIdx: index("selfAppraisals_personId_idx").on(table.personId),
}));

export type SelfAppraisal = typeof selfAppraisals.$inferSelect;
export type InsertSelfAppraisal = typeof selfAppraisals.$inferInsert;

// ============================================================================
// PACE APPRAISALS — chairman/manager completed appraisal records
// ============================================================================
export const paceAppraisals = mysqlTable("paceAppraisals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  personId: int("personId").notNull(),
  selfAppraisalId: int("selfAppraisalId"),
  appraiserId: int("appraiserId").notNull(),
  fiscalYear: varchar("fiscalYear", { length: 20 }),
  // AI-generated and human-edited PACE data
  paceData: json("paceData").$type<{
    kpiRows?: Array<{
      orgUnit?: string; goalName?: string; goalObjective?: string; weightage?: string;
      employeeSelfAppraisal?: string; appraiserComments?: string;
    }>;
    financialTable?: Array<{ lineItem?: string; fy25Actual?: string; fy26Aop?: string; fy26Actual?: string; varVsAop?: string }>;
    developmentGoals?: string[];
    employeeOverallComments?: string;
    appraiserOverallComments?: string;
    quadrant?: string;
    fitDetermination?: string;
  }>(),
  aiSynthesisSummary: text("aiSynthesisSummary"),
  status: mysqlEnum("status", ["AI_DRAFT", "IN_PROGRESS", "FINAL"]).default("AI_DRAFT"),
  exportedFileUrl: text("exportedFileUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  tenantIdx: index("paceAppraisals_tenantId_idx").on(table.tenantId),
  personIdx: index("paceAppraisals_personId_idx").on(table.personId),
  appraiserIdx: index("paceAppraisals_appraiserId_idx").on(table.appraiserId),
}));

export type PaceAppraisal = typeof paceAppraisals.$inferSelect;
export type InsertPaceAppraisal = typeof paceAppraisals.$inferInsert;
