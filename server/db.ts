import { eq, and, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  tenants, InsertTenant,
  orgUnits, InsertOrgUnit,
  persons, InsertPerson,
  roles, InsertRole,
  plans, InsertPlan,
  metrics, InsertMetric,
  metricValues, InsertMetricValue,
  evidence, InsertEvidence,
  observations, InsertObservation,
  selfReflections, InsertSelfReflection,
  memories, InsertMemory,
  assessments, InsertAssessment,
  reviews, InsertReview,
  meetings, InsertMeeting,
  incentiveConfigs, InsertIncentiveConfig,
  incentiveComputations, InsertIncentiveComputation,
  calibrationSessions, InsertCalibrationSession,
  decisions, InsertDecision,
  notifications, InsertNotification,
  financialUploads, InsertFinancialUpload,
  financialTemplates, InsertFinancialTemplate,
  auditLogs, InsertAuditLog,
  feedbackTypes, InsertFeedbackType,
  governanceCycles, InsertGovernanceCycle,
  governanceAssessments, InsertGovernanceAssessment,
  assessmentAssignments, InsertAssessmentAssignment,
  mandateJournals, InsertMandateJournal,
  companyReflections, InsertCompanyReflection,
  chairmanGuidance, InsertChairmanGuidance,
  dependencyChains, InsertDependencyChain,
  aiInsights, InsertAiInsight
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// TENANT MANAGEMENT
// ============================================================================

export async function createTenant(tenant: InsertTenant) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tenants).values(tenant);
  return result;
}

export async function getTenantBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// ORGANIZATIONAL STRUCTURE
// ============================================================================

export async function createOrgUnit(orgUnit: InsertOrgUnit) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orgUnits).values(orgUnit);
  return result;
}

export async function getOrgUnitsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(orgUnits).where(eq(orgUnits.tenantId, tenantId));
}

export async function getOrgUnitById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orgUnits).where(eq(orgUnits.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createPerson(person: InsertPerson) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(persons).values(person);
  return result;
}

export async function getPersonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(persons).where(eq(persons.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPersonByUserId(userId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(persons)
    .where(and(eq(persons.userId, userId), eq(persons.tenantId, tenantId)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPersonsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(persons).where(eq(persons.tenantId, tenantId));
}

export async function updatePersonDataSufficiency(personId: number, evidenceCount: number, sourceCount: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  let level = 0;
  if (evidenceCount >= 30 && sourceCount >= 4) level = 4;
  else if (evidenceCount >= 15 && sourceCount >= 3) level = 3;
  else if (evidenceCount >= 5 && sourceCount >= 2) level = 2;
  else if (evidenceCount >= 1 && sourceCount >= 1) level = 1;
  
  await db.update(persons)
    .set({ dataSufficiencyLevel: level, evidenceCount, sourceCount })
    .where(eq(persons.id, personId));
}

export async function createRole(role: InsertRole) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(roles).values(role);
  return result;
}

export async function getRoleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRolesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.isActive, true)));
}

export async function getActiveRoleByPerson(personId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(roles)
    .where(and(eq(roles.personId, personId), eq(roles.isActive, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDirectReports(roleId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(roles)
    .where(and(eq(roles.reportsToRoleId, roleId), eq(roles.isActive, true)));
}

// ============================================================================
// GOALS & METRICS
// ============================================================================

export async function createPlan(plan: InsertPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(plans).values(plan);
  return result;
}

export async function getPlansByOwner(ownerPersonId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(plans)
    .where(eq(plans.ownerPersonId, ownerPersonId))
    .orderBy(desc(plans.createdAt));
}

export async function getPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPlansByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(plans)
    .where(eq(plans.tenantId, tenantId))
    .orderBy(desc(plans.createdAt));
}

export async function createMetric(metric: InsertMetric) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(metrics).values(metric);
  return result;
}

export async function getMetricsByPlan(planId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(metrics).where(eq(metrics.planId, planId));
}

export async function createMetricValue(metricValue: InsertMetricValue) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(metricValues).values(metricValue);
  return result;
}

export async function getMetricValues(metricId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(metricValues)
    .where(eq(metricValues.metricId, metricId))
    .orderBy(desc(metricValues.periodDate));
}

// ============================================================================
// EVIDENCE & OBSERVATIONS
// ============================================================================

export async function createEvidence(evidenceData: InsertEvidence): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(evidence).values(evidenceData);
  return Number((result as any)[0]?.insertId || 0);
}

export async function getEvidenceByPerson(personId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(evidence)
    .where(and(
      eq(evidence.tenantId, tenantId),
      sql`JSON_CONTAINS(${evidence.taggedPersonIds}, ${JSON.stringify([personId])})`
    ))
    .orderBy(desc(evidence.uploadDate));
}

export async function getEvidenceByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select().from(evidence)
    .where(eq(evidence.tenantId, tenantId))
    .orderBy(desc(evidence.uploadDate));
}

export async function createObservation(observation: InsertObservation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(observations).values(observation);
  return result;
}

export async function getObservationsBySubject(subjectPersonId: number, tenantId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(observations)
    .where(and(
      eq(observations.tenantId, tenantId),
      eq(observations.subjectPersonId, subjectPersonId)
    ))
    .orderBy(desc(observations.createdAt))
    .limit(limit);
}

export async function getObservationsByObserver(observerPersonId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(observations)
    .where(and(
      eq(observations.tenantId, tenantId),
      eq(observations.observerPersonId, observerPersonId)
    ))
    .orderBy(desc(observations.createdAt));
}

export async function getRecentObservations(tenantId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(observations)
    .where(eq(observations.tenantId, tenantId))
    .orderBy(desc(observations.createdAt))
    .limit(limit);
}

export async function createSelfReflection(reflection: InsertSelfReflection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(selfReflections).values(reflection);
  return result;
}

export async function getSelfReflectionsByPerson(personId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(selfReflections)
    .where(and(
      eq(selfReflections.tenantId, tenantId),
      eq(selfReflections.personId, personId)
    ))
    .orderBy(desc(selfReflections.createdAt));
}

// ============================================================================
// MEMORY & AI
// ============================================================================

export async function createMemory(memory: InsertMemory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(memories).values(memory);
  return result;
}

export async function getMemoriesByPerson(personId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(memories)
    .where(and(
      eq(memories.tenantId, tenantId),
      eq(memories.personId, personId),
      eq(memories.verificationStatus, "VERIFIED")
    ))
    .orderBy(desc(memories.lastVerifiedAt));
}

// ============================================================================
// ASSESSMENTS & REVIEWS
// ============================================================================

export async function createAssessment(assessment: InsertAssessment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(assessments).values(assessment);
  return result;
}

export async function getAssessmentsByPerson(personId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assessments)
    .where(and(
      eq(assessments.tenantId, tenantId),
      eq(assessments.personId, personId)
    ))
    .orderBy(desc(assessments.createdAt));
}

export async function createReview(review: InsertReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values(review);
  return result;
}

export async function getReviewsByPerson(personId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(reviews)
    .where(and(
      eq(reviews.tenantId, tenantId),
      eq(reviews.personId, personId)
    ))
    .orderBy(desc(reviews.createdAt));
}

export async function updateReview(reviewId: number, updates: Partial<InsertReview>) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviews)
    .set(updates)
    .where(eq(reviews.id, reviewId));
}

// ============================================================================
// MEETINGS
// ============================================================================

export async function createMeeting(meeting: InsertMeeting) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(meetings).values(meeting);
  return result;
}

export async function getMeetingsByManager(managerPersonId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(meetings)
    .where(and(
      eq(meetings.tenantId, tenantId),
      eq(meetings.managerPersonId, managerPersonId)
    ))
    .orderBy(desc(meetings.startedAt));
}

// ============================================================================
// INCENTIVES
// ============================================================================

export async function createIncentiveConfig(config: InsertIncentiveConfig) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(incentiveConfigs).values(config);
  return result;
}

export async function getIncentiveConfigByOrgUnit(orgUnitId: number, fiscalYear: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(incentiveConfigs)
    .where(and(
      eq(incentiveConfigs.orgUnitId, orgUnitId),
      eq(incentiveConfigs.fiscalYear, fiscalYear),
      eq(incentiveConfigs.status, "ACTIVE")
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createIncentiveComputation(computation: InsertIncentiveComputation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(incentiveComputations).values(computation);
  return result;
}

export async function getIncentiveComputations(personId: number, fiscalYear: string) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(incentiveComputations)
    .where(and(
      eq(incentiveComputations.personId, personId),
      eq(incentiveComputations.fiscalYear, fiscalYear)
    ))
    .orderBy(desc(incentiveComputations.createdAt));
}

// ============================================================================
// CALIBRATION
// ============================================================================

export async function createCalibrationSession(session: InsertCalibrationSession) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(calibrationSessions).values(session);
  return result;
}

export async function getCalibrationSessionsByOrgUnit(orgUnitId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(calibrationSessions)
    .where(and(
      eq(calibrationSessions.tenantId, tenantId),
      eq(calibrationSessions.orgUnitId, orgUnitId)
    ))
    .orderBy(desc(calibrationSessions.createdAt));
}

// ============================================================================
// DECISIONS
// ============================================================================

export async function createDecision(decision: InsertDecision) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(decisions).values(decision);
  return result;
}

export async function getDecisionsByOwner(ownerPersonId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(decisions)
    .where(and(
      eq(decisions.tenantId, tenantId),
      eq(decisions.ownerPersonId, ownerPersonId)
    ))
    .orderBy(desc(decisions.createdAt));
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export async function createNotification(notification: InsertNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notifications).values(notification);
  return result;
}

export async function getNotificationsByPerson(personId: number, tenantId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(notifications)
    .where(and(
      eq(notifications.tenantId, tenantId),
      eq(notifications.personId, personId)
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markNotificationAsRead(notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, notificationId));
}

// ============================================================================
// FINANCIAL UPLOADS
// ============================================================================

export async function createFinancialUpload(upload: InsertFinancialUpload) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(financialUploads).values(upload);
  return result;
}

export async function getFinancialUploadsByOrgUnit(orgUnitId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(financialUploads)
    .where(and(
      eq(financialUploads.tenantId, tenantId),
      eq(financialUploads.orgUnitId, orgUnitId)
    ))
    .orderBy(desc(financialUploads.periodDate));
}

export async function checkDuplicateUpload(fileHash: string, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(financialUploads)
    .where(and(
      eq(financialUploads.tenantId, tenantId),
      eq(financialUploads.fileHash, fileHash)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createFinancialTemplate(template: InsertFinancialTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(financialTemplates).values(template);
  return result;
}

export async function getFinancialTemplatesByOrgUnit(orgUnitId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(financialTemplates)
    .where(and(
      eq(financialTemplates.tenantId, tenantId),
      eq(financialTemplates.orgUnitId, orgUnitId)
    ))
    .orderBy(desc(financialTemplates.successRate));
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

export async function createAuditLog(log: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(auditLogs).values(log);
  return result;
}

export async function getAuditLogsByEntity(entityType: string, entityId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(auditLogs)
    .where(and(
      eq(auditLogs.tenantId, tenantId),
      eq(auditLogs.entityType, entityType),
      eq(auditLogs.entityId, entityId)
    ))
    .orderBy(desc(auditLogs.createdAt));
}

// ============================================================================
// FEEDBACK TYPES
// ============================================================================

export async function getFeedbackTypesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(feedbackTypes)
    .where(and(
      eq(feedbackTypes.tenantId, tenantId),
      eq(feedbackTypes.isActive, true)
    ))
    .orderBy(asc(feedbackTypes.sortOrder));
}

export async function getFeedbackTypeByKey(key: string, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(feedbackTypes)
    .where(and(
      eq(feedbackTypes.tenantId, tenantId),
      eq(feedbackTypes.key, key)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createFeedbackType(type: InsertFeedbackType) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(feedbackTypes).values(type);
}

// ============================================================================
// GOVERNANCE CYCLES
// ============================================================================

export async function createGovernanceCycle(cycle: InsertGovernanceCycle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(governanceCycles).values(cycle);
}

export async function getGovernanceCyclesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(governanceCycles)
    .where(eq(governanceCycles.tenantId, tenantId))
    .orderBy(desc(governanceCycles.month));
}

export async function getActiveGovernanceCycle(tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(governanceCycles)
    .where(and(
      eq(governanceCycles.tenantId, tenantId),
      eq(governanceCycles.status, "OPEN")
    ))
    .orderBy(desc(governanceCycles.month))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGovernanceCycleByMonth(month: string, tenantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(governanceCycles)
    .where(and(
      eq(governanceCycles.tenantId, tenantId),
      eq(governanceCycles.month, month)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateGovernanceCycleStatus(
  cycleId: number,
  status: "DRAFT" | "OPEN" | "CLOSED" | "REVEALED",
  tenantId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(governanceCycles)
    .set({ status })
    .where(and(
      eq(governanceCycles.id, cycleId),
      eq(governanceCycles.tenantId, tenantId)
    ));
}

// ============================================================================
// GOVERNANCE ASSESSMENTS
// ============================================================================

export async function upsertGovernanceAssessment(a: InsertGovernanceAssessment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(governanceAssessments)
    .where(and(
      eq(governanceAssessments.tenantId, a.tenantId),
      eq(governanceAssessments.cycleId, a.cycleId),
      eq(governanceAssessments.assessorPersonId, a.assessorPersonId),
      eq(governanceAssessments.targetType, a.targetType),
      eq(governanceAssessments.targetId, a.targetId),
      eq(governanceAssessments.dimensionKey, a.dimensionKey),
      eq(governanceAssessments.feedbackTypeId, a.feedbackTypeId)
    ))
    .limit(1);

  if (existing.length > 0) {
    return await db.update(governanceAssessments)
      .set({
        score: a.score,
        rag: a.rag,
        note: a.note,
        confidenceNote: a.confidenceNote,
        submittedAt: a.submittedAt,
      })
      .where(eq(governanceAssessments.id, existing[0].id));
  }
  return await db.insert(governanceAssessments).values(a);
}

export async function getAssessmentsByAssessor(
  assessorPersonId: number,
  cycleId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(governanceAssessments)
    .where(and(
      eq(governanceAssessments.tenantId, tenantId),
      eq(governanceAssessments.cycleId, cycleId),
      eq(governanceAssessments.assessorPersonId, assessorPersonId)
    ));
}

export async function getAssessmentsForTarget(
  targetType: "ROLE" | "COMPANY" | "CHAIN",
  targetId: number,
  cycleId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(governanceAssessments)
    .where(and(
      eq(governanceAssessments.tenantId, tenantId),
      eq(governanceAssessments.cycleId, cycleId),
      eq(governanceAssessments.targetType, targetType),
      eq(governanceAssessments.targetId, targetId)
    ));
}

export async function getAssessmentsByCycle(cycleId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(governanceAssessments)
    .where(and(
      eq(governanceAssessments.tenantId, tenantId),
      eq(governanceAssessments.cycleId, cycleId)
    ));
}

// ============================================================================
// ASSESSMENT ASSIGNMENTS
// ============================================================================

export async function createAssessmentAssignments(assignments: InsertAssessmentAssignment[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (assignments.length === 0) return;
  return await db.insert(assessmentAssignments).values(assignments);
}

export async function getAssignmentsForAssessor(
  assessorPersonId: number,
  cycleId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assessmentAssignments)
    .where(and(
      eq(assessmentAssignments.tenantId, tenantId),
      eq(assessmentAssignments.cycleId, cycleId),
      eq(assessmentAssignments.assessorPersonId, assessorPersonId)
    ));
}

export async function getAssignmentsByCycle(cycleId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(assessmentAssignments)
    .where(and(
      eq(assessmentAssignments.tenantId, tenantId),
      eq(assessmentAssignments.cycleId, cycleId)
    ));
}

export async function updateAssignmentStatus(
  assignmentId: number,
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "OVERDUE",
  tenantId: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(assessmentAssignments)
    .set({ status })
    .where(and(
      eq(assessmentAssignments.id, assignmentId),
      eq(assessmentAssignments.tenantId, tenantId)
    ));
}

// ============================================================================
// MANDATE JOURNALS
// ============================================================================

export async function upsertMandateJournal(j: InsertMandateJournal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(mandateJournals)
    .where(and(
      eq(mandateJournals.tenantId, j.tenantId),
      eq(mandateJournals.personId, j.personId),
      eq(mandateJournals.cycleId, j.cycleId),
      eq(mandateJournals.dimensionKey, j.dimensionKey)
    ))
    .limit(1);

  if (existing.length > 0) {
    return await db.update(mandateJournals)
      .set({
        logText: j.logText,
        planText: j.planText,
        planItems: j.planItems,
        roleId: j.roleId,
        orgUnitId: j.orgUnitId,
      })
      .where(eq(mandateJournals.id, existing[0].id));
  }
  return await db.insert(mandateJournals).values(j);
}

export async function getMandateJournalsByPersonAndCycle(
  personId: number,
  cycleId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(mandateJournals)
    .where(and(
      eq(mandateJournals.tenantId, tenantId),
      eq(mandateJournals.personId, personId),
      eq(mandateJournals.cycleId, cycleId)
    ));
}

export async function getLastMandateJournal(
  personId: number,
  dimensionKey: string,
  beforeCycleId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(mandateJournals)
    .where(and(
      eq(mandateJournals.tenantId, tenantId),
      eq(mandateJournals.personId, personId),
      eq(mandateJournals.dimensionKey, dimensionKey),
      sql`${mandateJournals.cycleId} < ${beforeCycleId}`
    ))
    .orderBy(desc(mandateJournals.cycleId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// COMPANY REFLECTIONS
// ============================================================================

export async function upsertCompanyReflection(r: InsertCompanyReflection) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(companyReflections)
    .where(and(
      eq(companyReflections.tenantId, r.tenantId),
      eq(companyReflections.orgUnitId, r.orgUnitId),
      eq(companyReflections.cycleId, r.cycleId)
    ))
    .limit(1);

  if (existing.length > 0) {
    return await db.update(companyReflections)
      .set({
        wentWell: r.wentWell,
        didntGoWell: r.didntGoWell,
        risks: r.risks,
        needsFromFund: r.needsFromFund,
        forwardCommitments: r.forwardCommitments,
      })
      .where(eq(companyReflections.id, existing[0].id));
  }
  return await db.insert(companyReflections).values(r);
}

export async function getCompanyReflection(
  orgUnitId: number,
  cycleId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companyReflections)
    .where(and(
      eq(companyReflections.tenantId, tenantId),
      eq(companyReflections.orgUnitId, orgUnitId),
      eq(companyReflections.cycleId, cycleId)
    ))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getCompanyReflectionsByCycle(cycleId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companyReflections)
    .where(and(
      eq(companyReflections.tenantId, tenantId),
      eq(companyReflections.cycleId, cycleId)
    ));
}

// ============================================================================
// CHAIRMAN GUIDANCE
// ============================================================================

export async function createChairmanGuidance(g: InsertChairmanGuidance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(chairmanGuidance).values(g);
}

export async function getChairmanGuidanceForTarget(
  targetType: "ROLE" | "COMPANY",
  targetId: number,
  cycleId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(chairmanGuidance)
    .where(and(
      eq(chairmanGuidance.tenantId, tenantId),
      eq(chairmanGuidance.cycleId, cycleId),
      eq(chairmanGuidance.targetType, targetType),
      eq(chairmanGuidance.targetId, targetId)
    ));
}

// ============================================================================
// DEPENDENCY CHAINS
// ============================================================================

export async function getDependencyChainsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(dependencyChains)
    .where(eq(dependencyChains.tenantId, tenantId))
    .orderBy(asc(dependencyChains.sortOrder));
}

export async function createDependencyChain(c: InsertDependencyChain) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(dependencyChains).values(c);
}

// ============================================================================
// AI INSIGHTS
// ============================================================================

export async function createAiInsight(i: InsertAiInsight) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(aiInsights).values(i);
}

export async function getAiInsightsByCycle(cycleId: number, tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(aiInsights)
    .where(and(
      eq(aiInsights.tenantId, tenantId),
      eq(aiInsights.cycleId, cycleId)
    ))
    .orderBy(desc(aiInsights.severity), desc(aiInsights.createdAt));
}

export async function getAiInsightsByTarget(
  targetType: "ROLE" | "COMPANY" | "CHAIN" | "FUND",
  targetId: number,
  tenantId: number
) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(aiInsights)
    .where(and(
      eq(aiInsights.tenantId, tenantId),
      eq(aiInsights.targetType, targetType),
      eq(aiInsights.targetId, targetId)
    ))
    .orderBy(desc(aiInsights.createdAt));
}
