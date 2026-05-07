CREATE TABLE `paceAppraisals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`selfAppraisalId` int,
	`appraiserId` int NOT NULL,
	`fiscalYear` varchar(20),
	`paceData` json,
	`aiSynthesisSummary` text,
	`status` enum('AI_DRAFT','IN_PROGRESS','FINAL') DEFAULT 'AI_DRAFT',
	`exportedFileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paceAppraisals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selfAppraisals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`personId` int NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fiscalYear` varchar(20),
	`extractedData` json,
	`uploadedById` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `selfAppraisals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `roles` ADD `rolePurpose` text;--> statement-breakpoint
ALTER TABLE `roles` ADD `keyResponsibilities` json;--> statement-breakpoint
CREATE INDEX `paceAppraisals_tenantId_idx` ON `paceAppraisals` (`tenantId`);--> statement-breakpoint
CREATE INDEX `paceAppraisals_personId_idx` ON `paceAppraisals` (`personId`);--> statement-breakpoint
CREATE INDEX `paceAppraisals_appraiserId_idx` ON `paceAppraisals` (`appraiserId`);--> statement-breakpoint
CREATE INDEX `selfAppraisals_tenantId_idx` ON `selfAppraisals` (`tenantId`);--> statement-breakpoint
CREATE INDEX `selfAppraisals_personId_idx` ON `selfAppraisals` (`personId`);