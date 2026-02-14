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
  visibility: mysqlEnum("visibility", ["PRIVATE_DRAFT", "SHARED_WITH_MANAGER", "INCLUDED_IN_REVIEW"]).default("PRIVATE_DRAFT"),
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
  type: mysqlEnum("type", ["PRIORITY_ZERO", "INSIGHT", "REMINDER", "MILESTONE", "PULSE_CHECK", "ACHIEVEMENT_SUGGESTION"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body").notNull(),
  actionUrl: text("actionUrl"),
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("notifications_tenantId_idx").on(table.tenantId),
  personIdx: index("notifications_personId_idx").on(table.personId),
  isReadIdx: index("notifications_isRead_idx").on(table.isRead),
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
