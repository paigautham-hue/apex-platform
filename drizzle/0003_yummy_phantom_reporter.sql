CREATE TABLE `agenticMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`subjectPersonId` int,
	`subjectOrgUnitId` int,
	`orgScope` enum('FUND','COMPANY','FUNCTION','TEAM','INDIVIDUAL') DEFAULT 'INDIVIDUAL',
	`category` enum('PREFERENCE','FACT','PATTERN','INSIGHT','COMMITMENT','RELATIONSHIP') NOT NULL,
	`memoryKey` varchar(200) NOT NULL,
	`memoryValue` text NOT NULL,
	`rationale` text,
	`citations` json,
	`embeddingVector` json,
	`confidence` decimal(3,2) NOT NULL DEFAULT '0.70',
	`verified` boolean DEFAULT false,
	`needsVerification` boolean DEFAULT true,
	`verifiedAt` timestamp,
	`verifiedByPersonId` int,
	`expiresAt` timestamp,
	`sourceHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agenticMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiDeliberations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`cycleId` int,
	`targetType` enum('ROLE','COMPANY','PERSON') NOT NULL,
	`targetId` int NOT NULL,
	`triggeredByPersonId` int NOT NULL,
	`personaVerdicts` json,
	`synthesis` text,
	`recommendedActions` json,
	`status` enum('RUNNING','COMPLETE','FAILED') DEFAULT 'RUNNING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `aiDeliberations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiPersonaConfigs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`key` varchar(50) NOT NULL,
	`label` varchar(100) NOT NULL,
	`description` text,
	`systemPrompt` text NOT NULL,
	`availableForRoleTypes` json,
	`modelId` varchar(100) DEFAULT 'claude-opus-4-7',
	`isActive` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiPersonaConfigs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendarEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('GOOGLE','OUTLOOK') NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`title` text,
	`description` text,
	`startAt` timestamp NOT NULL,
	`endAt` timestamp,
	`attendees` json,
	`linkedPersonIds` json,
	`linkedMeetingId` int,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendarEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendarEvents_provider_external_uniq` UNIQUE(`provider`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `calendarTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('GOOGLE','OUTLOOK') NOT NULL,
	`email` varchar(320),
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`expiresAt` timestamp,
	`scope` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendarTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendarTokens_user_provider_uniq` UNIQUE(`userId`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `dailyFocusLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`focusDate` varchar(10) NOT NULL,
	`primaryActionType` varchar(50) NOT NULL,
	`primaryActionPayload` json,
	`primaryActionInsightId` int,
	`surfacedAt` timestamp NOT NULL DEFAULT (now()),
	`viewedAt` timestamp,
	`actedAt` timestamp,
	`dismissedAt` timestamp,
	CONSTRAINT `dailyFocusLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entryViews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`viewerPersonId` int NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int NOT NULL,
	`ownerPersonId` int NOT NULL,
	`viewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entryViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shareLinks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`resourceType` varchar(50) NOT NULL,
	`resourceId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`password` varchar(100),
	`viewCount` int NOT NULL DEFAULT 0,
	`lastViewedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shareLinks_id` PRIMARY KEY(`id`),
	CONSTRAINT `shareLinks_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `voiceSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`sessionType` enum('JOURNAL','PULSE','ASSESSMENT','ASK','MEETING_PREP') NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`durationSeconds` int,
	`transcript` text,
	`summary` text,
	`topicsDiscussed` json,
	`resultingEntityIds` json,
	`scopeContext` enum('FUND','COMPANY','FUNCTION','TEAM','INDIVIDUAL') DEFAULT 'INDIVIDUAL',
	CONSTRAINT `voiceSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('PRIORITY_ZERO','INSIGHT','REMINDER','MILESTONE','PULSE_CHECK','ACHIEVEMENT_SUGGESTION','CYCLE_OPEN','CYCLE_DEADLINE','CYCLE_REVEAL','PERCEPTION_GAP','MEETING_PREP','DAILY_FOCUS') NOT NULL;--> statement-breakpoint
ALTER TABLE `selfReflections` MODIFY COLUMN `visibility` enum('PRIVATE_FOREVER','PRIVATE_DRAFT','SHARED_WITH_MANAGER','INCLUDED_IN_REVIEW') DEFAULT 'PRIVATE_DRAFT';--> statement-breakpoint
ALTER TABLE `aiInsights` ADD `scope` enum('FUND','COMPANY','FUNCTION','TEAM','INDIVIDUAL') DEFAULT 'FUND';--> statement-breakpoint
ALTER TABLE `aiInsights` ADD `surfaceToPersonIds` json;--> statement-breakpoint
ALTER TABLE `aiInsights` ADD `urgency` int DEFAULT 50;--> statement-breakpoint
ALTER TABLE `aiInsights` ADD `status` enum('NEW','VIEWED','SNOOZED','ADDRESSED','DISMISSED') DEFAULT 'NEW';--> statement-breakpoint
ALTER TABLE `aiInsights` ADD `snoozedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `aiInsights` ADD `addressedAt` timestamp;--> statement-breakpoint
ALTER TABLE `aiInsights` ADD `addressedByPersonId` int;--> statement-breakpoint
ALTER TABLE `feedbackTypes` ADD `assessorRoleScope` json;--> statement-breakpoint
ALTER TABLE `feedbackTypes` ADD `autoRevealThresholdPct` int DEFAULT 80;--> statement-breakpoint
ALTER TABLE `notifications` ADD `tier` enum('INSTANT','DIGEST','QUIET') DEFAULT 'DIGEST';--> statement-breakpoint
ALTER TABLE `notifications` ADD `digestedOn` varchar(10);--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `defaultLandingPath` enum('me','team','group','today') DEFAULT 'me' NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `voiceFirstCapture` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `dailyFocusEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `weeklyPulseEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `userPreferences` ADD `preferredVoiceLocale` varchar(10) DEFAULT 'en-IN' NOT NULL;--> statement-breakpoint
CREATE INDEX `agenticMemories_tenantId_idx` ON `agenticMemories` (`tenantId`);--> statement-breakpoint
CREATE INDEX `agenticMemories_subjectPersonId_idx` ON `agenticMemories` (`subjectPersonId`);--> statement-breakpoint
CREATE INDEX `agenticMemories_subjectOrgUnitId_idx` ON `agenticMemories` (`subjectOrgUnitId`);--> statement-breakpoint
CREATE INDEX `agenticMemories_orgScope_idx` ON `agenticMemories` (`orgScope`);--> statement-breakpoint
CREATE INDEX `agenticMemories_category_idx` ON `agenticMemories` (`category`);--> statement-breakpoint
CREATE INDEX `aiDeliberations_tenantId_idx` ON `aiDeliberations` (`tenantId`);--> statement-breakpoint
CREATE INDEX `aiDeliberations_targetType_targetId_idx` ON `aiDeliberations` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `aiDeliberations_triggeredByPersonId_idx` ON `aiDeliberations` (`triggeredByPersonId`);--> statement-breakpoint
CREATE INDEX `aiPersonaConfigs_tenantId_idx` ON `aiPersonaConfigs` (`tenantId`);--> statement-breakpoint
CREATE INDEX `aiPersonaConfigs_key_idx` ON `aiPersonaConfigs` (`key`);--> statement-breakpoint
CREATE INDEX `calendarEvents_tenantId_idx` ON `calendarEvents` (`tenantId`);--> statement-breakpoint
CREATE INDEX `calendarEvents_userId_idx` ON `calendarEvents` (`userId`);--> statement-breakpoint
CREATE INDEX `calendarEvents_startAt_idx` ON `calendarEvents` (`startAt`);--> statement-breakpoint
CREATE INDEX `calendarTokens_tenantId_idx` ON `calendarTokens` (`tenantId`);--> statement-breakpoint
CREATE INDEX `calendarTokens_userId_idx` ON `calendarTokens` (`userId`);--> statement-breakpoint
CREATE INDEX `dailyFocusLog_tenantId_idx` ON `dailyFocusLog` (`tenantId`);--> statement-breakpoint
CREATE INDEX `dailyFocusLog_personId_idx` ON `dailyFocusLog` (`personId`);--> statement-breakpoint
CREATE INDEX `dailyFocusLog_focusDate_idx` ON `dailyFocusLog` (`focusDate`);--> statement-breakpoint
CREATE INDEX `entryViews_tenantId_idx` ON `entryViews` (`tenantId`);--> statement-breakpoint
CREATE INDEX `entryViews_ownerPersonId_idx` ON `entryViews` (`ownerPersonId`);--> statement-breakpoint
CREATE INDEX `entryViews_entityType_entityId_idx` ON `entryViews` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `shareLinks_tenantId_idx` ON `shareLinks` (`tenantId`);--> statement-breakpoint
CREATE INDEX `shareLinks_token_idx` ON `shareLinks` (`token`);--> statement-breakpoint
CREATE INDEX `voiceSessions_tenantId_idx` ON `voiceSessions` (`tenantId`);--> statement-breakpoint
CREATE INDEX `voiceSessions_personId_idx` ON `voiceSessions` (`personId`);--> statement-breakpoint
CREATE INDEX `voiceSessions_sessionType_idx` ON `voiceSessions` (`sessionType`);--> statement-breakpoint
CREATE INDEX `aiInsights_scope_idx` ON `aiInsights` (`scope`);--> statement-breakpoint
CREATE INDEX `aiInsights_status_idx` ON `aiInsights` (`status`);--> statement-breakpoint
CREATE INDEX `notifications_tier_idx` ON `notifications` (`tier`);