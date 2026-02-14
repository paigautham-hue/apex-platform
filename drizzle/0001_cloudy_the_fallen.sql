CREATE TABLE `assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`type` enum('MILESTONE_30','MILESTONE_60','MILESTONE_90','MILESTONE_180','MILESTONE_365','QUARTERLY','ANNUAL') NOT NULL,
	`performanceScores` json,
	`valuesScores` json,
	`aiSignalSummary` text,
	`humanJudgment` text,
	`coverageMetrics` json,
	`supportingMemoryIds` json,
	`assessorPersonId` int NOT NULL,
	`status` enum('AI_DRAFT','MANAGER_DRAFT','UNDER_REVIEW','CALIBRATED','FINAL') DEFAULT 'AI_DRAFT',
	`quadrant` enum('STAR','BRILLIANT_JERK','HIGH_POTENTIAL','NEEDS_DEVELOPMENT'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(100) NOT NULL,
	`entityId` int NOT NULL,
	`changes` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calibrationSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`orgUnitId` int NOT NULL,
	`period` varchar(50) NOT NULL,
	`participants` json,
	`status` enum('ASYNC_REVIEW','DISAGREEMENTS_IDENTIFIED','LIVE_SESSION','COMPLETED') DEFAULT 'ASYNC_REVIEW',
	`assessmentsReviewed` json,
	`changesLog` json,
	`asyncDeadline` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calibrationSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`ownerPersonId` int NOT NULL,
	`orgUnitId` int,
	`decisionText` text NOT NULL,
	`assumptions` json,
	`expectedOutcome` text,
	`risksIdentified` json,
	`reviewDate` timestamp,
	`retrospectiveText` text,
	`outcomeAssessment` enum('BETTER_THAN_EXPECTED','AS_EXPECTED','WORSE_THAN_EXPECTED','PENDING') DEFAULT 'PENDING',
	`linkedMetricIds` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`type` enum('SCREENSHOT','EMAIL','DOCUMENT','VOICE_NOTE','ARTICLE','MEETING_NOTE','FINANCIAL_REPORT') NOT NULL,
	`contentText` text,
	`fileUrl` text,
	`uploadDate` timestamp NOT NULL DEFAULT (now()),
	`uploaderPersonId` int NOT NULL,
	`taggedPersonIds` json,
	`sourceType` enum('SELF_OBSERVATION','PEER_FEEDBACK','CUSTOMER_EMAIL','MEETING_NOTE','ARTICLE_SHARE','KPI_DATA','FINANCIAL_UPLOAD') NOT NULL,
	`direction` enum('POSITIVE','NEGATIVE','MIXED','NEUTRAL'),
	`valueTags` json,
	`goalLinks` json,
	`visibility` enum('DRAFT','MANAGER_REVIEW','OFFICIAL') DEFAULT 'DRAFT',
	`credibilityTier` int DEFAULT 3,
	`isCoolDown` boolean DEFAULT false,
	`coolDownExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`orgUnitId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`fileType` enum('EXCEL','POWERPOINT','PDF') NOT NULL,
	`extractionRules` json,
	`learnedPatterns` json,
	`successRate` decimal(5,2),
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financialUploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`orgUnitId` int NOT NULL,
	`uploaderPersonId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileHash` varchar(64) NOT NULL,
	`periodDate` timestamp NOT NULL,
	`extractedData` json,
	`confidenceScores` json,
	`templateId` int,
	`status` enum('PENDING','EXTRACTED','CONFIRMED','REJECTED') DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialUploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incentiveComputations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`fiscalYear` varchar(20) NOT NULL,
	`period` enum('Q1','Q2','Q3','Q4','ANNUAL') NOT NULL,
	`configId` int NOT NULL,
	`financialActuals` json,
	`achievementPercentages` json,
	`slabPayouts` json,
	`financialWeightedPayout` decimal(5,2),
	`nonFinancialScore` decimal(5,2),
	`nonFinancialWeightedPayout` decimal(5,2),
	`totalWeightedPayoutPercentage` decimal(5,2),
	`totalProjectedPayout` decimal(15,2),
	`status` enum('PROJECTED','PRELIMINARY','BOARD_APPROVED','FINAL') DEFAULT 'PROJECTED',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incentiveComputations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incentiveConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`orgUnitId` int NOT NULL,
	`fiscalYear` varchar(20) NOT NULL,
	`businessType` enum('GROWTH','HARVEST','INCUBATE') NOT NULL,
	`eligibilityThreshold` json,
	`financialWeight` decimal(3,2) DEFAULT '0.60',
	`nonFinancialWeight` decimal(3,2) DEFAULT '0.40',
	`financialMetricWeights` json,
	`nonFinancialSplits` json,
	`slabStructure` json,
	`stretchTarget` json,
	`ofcfFormula` text,
	`negativeTargetMethod` enum('IMPROVEMENT_RATIO','ABSOLUTE_DELTA','CUSTOM') DEFAULT 'IMPROVEMENT_RATIO',
	`cxoCascadeOverrides` json,
	`status` enum('DRAFT','ACTIVE','ARCHIVED') DEFAULT 'DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incentiveConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`managerPersonId` int NOT NULL,
	`subjectPersonId` int NOT NULL,
	`startedAt` timestamp NOT NULL,
	`endedAt` timestamp,
	`type` enum('ONE_ON_ONE','TEAM','REVIEW','CALIBRATION') NOT NULL,
	`prepCardViewed` boolean DEFAULT false,
	`postMeetingObservationId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meetings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`claimText` text NOT NULL,
	`evidenceIds` json,
	`personId` int NOT NULL,
	`confidenceScore` decimal(3,2),
	`validityScope` json,
	`expiryTriggers` json,
	`verificationStatus` enum('VERIFIED','HISTORICAL','NEEDS_REVIEW') DEFAULT 'VERIFIED',
	`valueTags` json,
	`performanceDimensions` json,
	`embeddingVector` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastVerifiedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metricValues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`metricId` int NOT NULL,
	`periodDate` timestamp NOT NULL,
	`periodType` enum('MONTHLY','QUARTERLY','ANNUAL','CUMULATIVE_YTD') NOT NULL,
	`actualValue` decimal(15,2) NOT NULL,
	`targetValue` decimal(15,2),
	`sourceUploadId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metricValues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`definition` text,
	`formula` text,
	`planId` int NOT NULL,
	`targetValue` decimal(15,2),
	`updateCadence` enum('MONTHLY','QUARTERLY','ANNUAL') NOT NULL,
	`dataSource` varchar(255),
	`ownerPersonId` int,
	`driverTreePosition` json,
	`isNegativeTarget` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`type` enum('PRIORITY_ZERO','INSIGHT','REMINDER','MILESTONE','PULSE_CHECK','ACHIEVEMENT_SUGGESTION') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`actionUrl` text,
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`observerPersonId` int NOT NULL,
	`subjectPersonId` int NOT NULL,
	`text` text NOT NULL,
	`voiceTranscript` text,
	`direction` enum('POSITIVE','NEEDS_IMPROVEMENT','NEUTRAL') NOT NULL,
	`valueTags` json,
	`performanceTags` json,
	`templateUsed` varchar(100),
	`source` enum('QUICK_NOTE','VOICE_MEMO','WEEKLY_PULSE','MEETING_LOGGER','TEMPLATE') NOT NULL,
	`meetingId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `observations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orgUnits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('HOLDING_COMPANY','PORTFOLIO_COMPANY','FUNCTION','TEAM','SUB_BUSINESS') NOT NULL,
	`parentOrgUnitId` int,
	`leaderPersonId` int,
	`businessType` enum('GROWTH','HARVEST','INCUBATE'),
	`lifecycleStage` enum('STARTUP','GROWTH','MATURE','TURNAROUND'),
	`industrySector` text,
	`currency` varchar(10) DEFAULT 'INR',
	`currencyDisplayUnit` varchar(10) DEFAULT 'Cr',
	`fiscalYearStartMonth` int DEFAULT 4,
	`customMetrics` json,
	`customGoalCategories` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orgUnits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `persons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50),
	`photoUrl` text,
	`currentRoleId` int,
	`hireDate` timestamp,
	`tenure` int,
	`valuesProfile` json,
	`performanceHistory` json,
	`capabilityProfile` json,
	`hiringThesis` json,
	`dataSufficiencyLevel` int DEFAULT 0,
	`evidenceCount` int DEFAULT 0,
	`sourceCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `persons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('PORTFOLIO_STRATEGY','BUSINESS_PLAN','ANNUAL_OPERATING_PLAN','FUNCTION_PLAN','OKR','INDIVIDUAL_GOAL') NOT NULL,
	`ownerPersonId` int NOT NULL,
	`orgUnitId` int NOT NULL,
	`parentPlanId` int,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`category` enum('FINANCIAL','STRATEGIC','OPERATIONAL','SUSTAINABILITY','LEADERSHIP','GOVERNANCE') NOT NULL,
	`weightPercentage` decimal(5,2),
	`targets` json,
	`assumptions` json,
	`status` enum('DRAFT','ACTIVE','COMPLETED','CANCELLED') DEFAULT 'DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`assessmentId` int NOT NULL,
	`personId` int NOT NULL,
	`type` enum('MILESTONE','QUARTERLY','ANNUAL') NOT NULL,
	`aiGeneratedDraft` text,
	`managerEditedVersion` text,
	`employeeResponse` text,
	`status` enum('DRAFT','SHARED','ACKNOWLEDGED','CONTESTED','FINAL') DEFAULT 'DRAFT',
	`fitDetermination` enum('STRONG_FIT','DEVELOPING','CONCERNS','NOT_FIT'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`personId` int NOT NULL,
	`orgUnitId` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp,
	`reportsToRoleId` int,
	`scopeDescription` text,
	`successMetrics` json,
	`roleType` enum('CEO','CXO','CXO_PLUS_ONE','CHRO','BOARD_MEMBER','CHAIRMAN','GROUP_CEO','GROUP_CHRO') NOT NULL,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selfReflections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`type` enum('ACHIEVEMENT','LEARNING','CHALLENGE_OVERCOME','CROSS_FUNCTIONAL','FEEDBACK_RECEIVED','DEVELOPMENT_ACTIVITY') NOT NULL,
	`text` text NOT NULL,
	`attachments` json,
	`autoTags` json,
	`corroborationStatus` enum('PENDING','CORROBORATED','SELF_ONLY') DEFAULT 'PENDING',
	`corroboratedBy` json,
	`visibility` enum('PRIVATE_DRAFT','SHARED_WITH_MANAGER','INCLUDED_IN_REVIEW') DEFAULT 'PRIVATE_DRAFT',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `selfReflections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `assessments_tenantId_idx` ON `assessments` (`tenantId`);--> statement-breakpoint
CREATE INDEX `assessments_personId_idx` ON `assessments` (`personId`);--> statement-breakpoint
CREATE INDEX `assessments_status_idx` ON `assessments` (`status`);--> statement-breakpoint
CREATE INDEX `auditLogs_tenantId_idx` ON `auditLogs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `auditLogs_userId_idx` ON `auditLogs` (`userId`);--> statement-breakpoint
CREATE INDEX `auditLogs_entityType_entityId_idx` ON `auditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `auditLogs_createdAt_idx` ON `auditLogs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `calibrationSessions_tenantId_idx` ON `calibrationSessions` (`tenantId`);--> statement-breakpoint
CREATE INDEX `calibrationSessions_orgUnitId_idx` ON `calibrationSessions` (`orgUnitId`);--> statement-breakpoint
CREATE INDEX `calibrationSessions_status_idx` ON `calibrationSessions` (`status`);--> statement-breakpoint
CREATE INDEX `decisions_tenantId_idx` ON `decisions` (`tenantId`);--> statement-breakpoint
CREATE INDEX `decisions_ownerPersonId_idx` ON `decisions` (`ownerPersonId`);--> statement-breakpoint
CREATE INDEX `evidence_tenantId_idx` ON `evidence` (`tenantId`);--> statement-breakpoint
CREATE INDEX `evidence_uploaderPersonId_idx` ON `evidence` (`uploaderPersonId`);--> statement-breakpoint
CREATE INDEX `evidence_uploadDate_idx` ON `evidence` (`uploadDate`);--> statement-breakpoint
CREATE INDEX `evidence_visibility_idx` ON `evidence` (`visibility`);--> statement-breakpoint
CREATE INDEX `financialTemplates_tenantId_idx` ON `financialTemplates` (`tenantId`);--> statement-breakpoint
CREATE INDEX `financialTemplates_orgUnitId_idx` ON `financialTemplates` (`orgUnitId`);--> statement-breakpoint
CREATE INDEX `financialUploads_tenantId_idx` ON `financialUploads` (`tenantId`);--> statement-breakpoint
CREATE INDEX `financialUploads_orgUnitId_idx` ON `financialUploads` (`orgUnitId`);--> statement-breakpoint
CREATE INDEX `financialUploads_periodDate_idx` ON `financialUploads` (`periodDate`);--> statement-breakpoint
CREATE INDEX `financialUploads_fileHash_idx` ON `financialUploads` (`fileHash`);--> statement-breakpoint
CREATE INDEX `incentiveComputations_tenantId_idx` ON `incentiveComputations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `incentiveComputations_personId_idx` ON `incentiveComputations` (`personId`);--> statement-breakpoint
CREATE INDEX `incentiveComputations_fiscalYear_idx` ON `incentiveComputations` (`fiscalYear`);--> statement-breakpoint
CREATE INDEX `incentiveConfigs_tenantId_idx` ON `incentiveConfigs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `incentiveConfigs_orgUnitId_idx` ON `incentiveConfigs` (`orgUnitId`);--> statement-breakpoint
CREATE INDEX `incentiveConfigs_fiscalYear_idx` ON `incentiveConfigs` (`fiscalYear`);--> statement-breakpoint
CREATE INDEX `meetings_tenantId_idx` ON `meetings` (`tenantId`);--> statement-breakpoint
CREATE INDEX `meetings_managerPersonId_idx` ON `meetings` (`managerPersonId`);--> statement-breakpoint
CREATE INDEX `meetings_subjectPersonId_idx` ON `meetings` (`subjectPersonId`);--> statement-breakpoint
CREATE INDEX `memories_tenantId_idx` ON `memories` (`tenantId`);--> statement-breakpoint
CREATE INDEX `memories_personId_idx` ON `memories` (`personId`);--> statement-breakpoint
CREATE INDEX `memories_verificationStatus_idx` ON `memories` (`verificationStatus`);--> statement-breakpoint
CREATE INDEX `metricValues_metricId_idx` ON `metricValues` (`metricId`);--> statement-breakpoint
CREATE INDEX `metricValues_periodDate_idx` ON `metricValues` (`periodDate`);--> statement-breakpoint
CREATE INDEX `metrics_tenantId_idx` ON `metrics` (`tenantId`);--> statement-breakpoint
CREATE INDEX `metrics_planId_idx` ON `metrics` (`planId`);--> statement-breakpoint
CREATE INDEX `notifications_tenantId_idx` ON `notifications` (`tenantId`);--> statement-breakpoint
CREATE INDEX `notifications_personId_idx` ON `notifications` (`personId`);--> statement-breakpoint
CREATE INDEX `notifications_isRead_idx` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `observations_tenantId_idx` ON `observations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `observations_observerPersonId_idx` ON `observations` (`observerPersonId`);--> statement-breakpoint
CREATE INDEX `observations_subjectPersonId_idx` ON `observations` (`subjectPersonId`);--> statement-breakpoint
CREATE INDEX `observations_createdAt_idx` ON `observations` (`createdAt`);--> statement-breakpoint
CREATE INDEX `orgUnits_tenantId_idx` ON `orgUnits` (`tenantId`);--> statement-breakpoint
CREATE INDEX `orgUnits_parentOrgUnitId_idx` ON `orgUnits` (`parentOrgUnitId`);--> statement-breakpoint
CREATE INDEX `persons_tenantId_idx` ON `persons` (`tenantId`);--> statement-breakpoint
CREATE INDEX `persons_userId_idx` ON `persons` (`userId`);--> statement-breakpoint
CREATE INDEX `persons_email_idx` ON `persons` (`email`);--> statement-breakpoint
CREATE INDEX `plans_tenantId_idx` ON `plans` (`tenantId`);--> statement-breakpoint
CREATE INDEX `plans_ownerPersonId_idx` ON `plans` (`ownerPersonId`);--> statement-breakpoint
CREATE INDEX `plans_orgUnitId_idx` ON `plans` (`orgUnitId`);--> statement-breakpoint
CREATE INDEX `plans_status_idx` ON `plans` (`status`);--> statement-breakpoint
CREATE INDEX `reviews_tenantId_idx` ON `reviews` (`tenantId`);--> statement-breakpoint
CREATE INDEX `reviews_assessmentId_idx` ON `reviews` (`assessmentId`);--> statement-breakpoint
CREATE INDEX `reviews_personId_idx` ON `reviews` (`personId`);--> statement-breakpoint
CREATE INDEX `reviews_status_idx` ON `reviews` (`status`);--> statement-breakpoint
CREATE INDEX `roles_tenantId_idx` ON `roles` (`tenantId`);--> statement-breakpoint
CREATE INDEX `roles_personId_idx` ON `roles` (`personId`);--> statement-breakpoint
CREATE INDEX `roles_orgUnitId_idx` ON `roles` (`orgUnitId`);--> statement-breakpoint
CREATE INDEX `roles_isActive_idx` ON `roles` (`isActive`);--> statement-breakpoint
CREATE INDEX `selfReflections_tenantId_idx` ON `selfReflections` (`tenantId`);--> statement-breakpoint
CREATE INDEX `selfReflections_personId_idx` ON `selfReflections` (`personId`);--> statement-breakpoint
CREATE INDEX `selfReflections_visibility_idx` ON `selfReflections` (`visibility`);