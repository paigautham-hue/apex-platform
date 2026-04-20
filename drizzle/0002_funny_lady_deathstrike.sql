CREATE TABLE `accessChallenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`submittedByUserId` int NOT NULL,
	`challengeType` enum('UNAUTHORIZED_ACCESS','INCORRECT_VISIBILITY','MISSING_ACCESS','DATA_ACCURACY','PRIVACY_CONCERN','OTHER') NOT NULL,
	`description` text NOT NULL,
	`relatedGrantId` int,
	`status` enum('PENDING','UNDER_REVIEW','RESOLVED','DISMISSED') NOT NULL DEFAULT 'PENDING',
	`resolution` text,
	`resolvedByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accessChallenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `accessGrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`grantedByUserId` int NOT NULL,
	`grantedToUserId` int,
	`grantedToEmail` varchar(320) NOT NULL,
	`targetOrgUnitId` int NOT NULL,
	`accessLevel` enum('VIEW_ONLY','VIEW_AND_COMMENT','FULL_ACCESS') NOT NULL,
	`justification` text,
	`expiresAt` timestamp NOT NULL,
	`status` enum('ACTIVE','EXPIRED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
	`revokedAt` timestamp,
	`revokedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accessGrants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiInsights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`cycleId` int,
	`insightType` enum('PERCEPTION_GAP','COMMITMENT_TRACKING','ENGAGEMENT_PATTERN','CHAIN_RISK','FINANCIAL_MISMATCH','TREND_ALERT','360_SYNTHESIS') NOT NULL,
	`targetType` enum('ROLE','COMPANY','CHAIN','FUND'),
	`targetId` int,
	`insightText` text NOT NULL,
	`severity` enum('INFO','WARNING','CRITICAL') DEFAULT 'INFO',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiInsights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assessmentAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`cycleId` int NOT NULL,
	`assessorPersonId` int NOT NULL,
	`targetType` enum('ROLE','COMPANY','CHAIN') NOT NULL,
	`targetId` int NOT NULL,
	`feedbackTypeId` int NOT NULL,
	`status` enum('PENDING','IN_PROGRESS','SUBMITTED','OVERDUE') DEFAULT 'PENDING',
	`dueDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assessmentAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chairmanGuidance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`cycleId` int NOT NULL,
	`chairmanPersonId` int NOT NULL,
	`targetType` enum('ROLE','COMPANY') NOT NULL,
	`targetId` int NOT NULL,
	`dimensionKey` varchar(100),
	`guidanceText` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chairmanGuidance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companyReflections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`ceoPersonId` int NOT NULL,
	`orgUnitId` int NOT NULL,
	`cycleId` int NOT NULL,
	`wentWell` json,
	`didntGoWell` json,
	`risks` json,
	`needsFromFund` json,
	`forwardCommitments` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companyReflections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dependencyChains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) NOT NULL,
	`description` text,
	`nodeRoleIds` json,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dependencyChains_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedbackTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`key` varchar(50) NOT NULL,
	`label` varchar(100) NOT NULL,
	`description` text,
	`visibilityRule` enum('IMMEDIATE','AFTER_ALL_SUBMIT','AFTER_DEADLINE','ADMIN_RELEASE') DEFAULT 'AFTER_ALL_SUBMIT',
	`isBlind` boolean DEFAULT false,
	`revealTrigger` varchar(100),
	`cadence` enum('MONTHLY','QUARTERLY','SEMI_ANNUAL','ANNUAL') DEFAULT 'MONTHLY',
	`isActive` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedbackTypes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `governanceAssessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`cycleId` int NOT NULL,
	`assessorPersonId` int NOT NULL,
	`targetType` enum('ROLE','COMPANY','CHAIN') NOT NULL,
	`targetId` int NOT NULL,
	`dimensionKey` varchar(100) NOT NULL,
	`feedbackTypeId` int NOT NULL,
	`score` int,
	`rag` enum('RED','AMBER','GREEN'),
	`note` text,
	`confidenceNote` text,
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governanceAssessments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `governanceCycles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`month` varchar(7) NOT NULL,
	`status` enum('DRAFT','OPEN','CLOSED','REVEALED') DEFAULT 'DRAFT',
	`openDate` timestamp,
	`deadlineDate` timestamp,
	`revealDate` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `governanceCycles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mandateJournals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`cycleId` int NOT NULL,
	`roleId` int,
	`orgUnitId` int,
	`dimensionKey` varchar(100) NOT NULL,
	`logText` text,
	`planText` text,
	`planItems` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mandateJournals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notifyPriorityZero` boolean NOT NULL DEFAULT true,
	`notifyInsights` boolean NOT NULL DEFAULT true,
	`notifyReminders` boolean NOT NULL DEFAULT true,
	`notifyMilestones` boolean NOT NULL DEFAULT true,
	`notifyPulseCheck` boolean NOT NULL DEFAULT true,
	`notifyAchievementSuggestions` boolean NOT NULL DEFAULT true,
	`notifyBrowserPush` boolean NOT NULL DEFAULT false,
	`quietHoursStart` varchar(5) NOT NULL DEFAULT '22:00',
	`quietHoursEnd` varchar(5) NOT NULL DEFAULT '08:00',
	`maxNotificationsPerDay` int NOT NULL DEFAULT 3,
	`onboardingCompleted` boolean NOT NULL DEFAULT false,
	`onboardingCompletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `userPreferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `accessChallenges_tenantId_idx` ON `accessChallenges` (`tenantId`);--> statement-breakpoint
CREATE INDEX `accessChallenges_submittedByUserId_idx` ON `accessChallenges` (`submittedByUserId`);--> statement-breakpoint
CREATE INDEX `accessChallenges_status_idx` ON `accessChallenges` (`status`);--> statement-breakpoint
CREATE INDEX `accessGrants_tenantId_idx` ON `accessGrants` (`tenantId`);--> statement-breakpoint
CREATE INDEX `accessGrants_grantedByUserId_idx` ON `accessGrants` (`grantedByUserId`);--> statement-breakpoint
CREATE INDEX `accessGrants_status_idx` ON `accessGrants` (`status`);--> statement-breakpoint
CREATE INDEX `aiInsights_tenantId_idx` ON `aiInsights` (`tenantId`);--> statement-breakpoint
CREATE INDEX `aiInsights_cycleId_idx` ON `aiInsights` (`cycleId`);--> statement-breakpoint
CREATE INDEX `aiInsights_insightType_idx` ON `aiInsights` (`insightType`);--> statement-breakpoint
CREATE INDEX `assessAssign_tenantId_idx` ON `assessmentAssignments` (`tenantId`);--> statement-breakpoint
CREATE INDEX `assessAssign_cycleId_idx` ON `assessmentAssignments` (`cycleId`);--> statement-breakpoint
CREATE INDEX `assessAssign_assessorPersonId_idx` ON `assessmentAssignments` (`assessorPersonId`);--> statement-breakpoint
CREATE INDEX `assessAssign_status_idx` ON `assessmentAssignments` (`status`);--> statement-breakpoint
CREATE INDEX `chairmanGuidance_tenantId_idx` ON `chairmanGuidance` (`tenantId`);--> statement-breakpoint
CREATE INDEX `chairmanGuidance_cycleId_idx` ON `chairmanGuidance` (`cycleId`);--> statement-breakpoint
CREATE INDEX `chairmanGuidance_targetType_targetId_idx` ON `chairmanGuidance` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `companyReflections_tenantId_idx` ON `companyReflections` (`tenantId`);--> statement-breakpoint
CREATE INDEX `companyReflections_ceoPersonId_idx` ON `companyReflections` (`ceoPersonId`);--> statement-breakpoint
CREATE INDEX `companyReflections_cycleId_idx` ON `companyReflections` (`cycleId`);--> statement-breakpoint
CREATE INDEX `companyReflections_orgUnitId_idx` ON `companyReflections` (`orgUnitId`);--> statement-breakpoint
CREATE INDEX `dependencyChains_tenantId_idx` ON `dependencyChains` (`tenantId`);--> statement-breakpoint
CREATE INDEX `feedbackTypes_tenantId_idx` ON `feedbackTypes` (`tenantId`);--> statement-breakpoint
CREATE INDEX `feedbackTypes_key_idx` ON `feedbackTypes` (`key`);--> statement-breakpoint
CREATE INDEX `govAssessments_tenantId_idx` ON `governanceAssessments` (`tenantId`);--> statement-breakpoint
CREATE INDEX `govAssessments_cycleId_idx` ON `governanceAssessments` (`cycleId`);--> statement-breakpoint
CREATE INDEX `govAssessments_assessorPersonId_idx` ON `governanceAssessments` (`assessorPersonId`);--> statement-breakpoint
CREATE INDEX `govAssessments_targetType_targetId_idx` ON `governanceAssessments` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `govAssessments_feedbackTypeId_idx` ON `governanceAssessments` (`feedbackTypeId`);--> statement-breakpoint
CREATE INDEX `governanceCycles_tenantId_idx` ON `governanceCycles` (`tenantId`);--> statement-breakpoint
CREATE INDEX `governanceCycles_month_idx` ON `governanceCycles` (`month`);--> statement-breakpoint
CREATE INDEX `governanceCycles_status_idx` ON `governanceCycles` (`status`);--> statement-breakpoint
CREATE INDEX `mandateJournals_tenantId_idx` ON `mandateJournals` (`tenantId`);--> statement-breakpoint
CREATE INDEX `mandateJournals_personId_idx` ON `mandateJournals` (`personId`);--> statement-breakpoint
CREATE INDEX `mandateJournals_cycleId_idx` ON `mandateJournals` (`cycleId`);--> statement-breakpoint
CREATE INDEX `mandateJournals_roleId_idx` ON `mandateJournals` (`roleId`);--> statement-breakpoint
CREATE INDEX `userPreferences_userId_idx` ON `userPreferences` (`userId`);