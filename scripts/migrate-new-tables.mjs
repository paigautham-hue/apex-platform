import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS \`accessGrants\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`tenantId\` int NOT NULL,
    \`grantedByUserId\` int NOT NULL,
    \`grantedToUserId\` int,
    \`grantedToEmail\` varchar(320) NOT NULL,
    \`targetOrgUnitId\` int NOT NULL,
    \`accessLevel\` enum('VIEW_ONLY','VIEW_AND_COMMENT','FULL_ACCESS') NOT NULL,
    \`justification\` text,
    \`expiresAt\` timestamp NOT NULL,
    \`status\` enum('ACTIVE','EXPIRED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
    \`revokedAt\` timestamp,
    \`revokedByUserId\` int,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`accessGrants_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`accessChallenges\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`tenantId\` int NOT NULL,
    \`submittedByUserId\` int NOT NULL,
    \`challengeType\` enum('UNAUTHORIZED_ACCESS','INCORRECT_VISIBILITY','MISSING_ACCESS','DATA_ACCURACY','PRIVACY_CONCERN','OTHER') NOT NULL,
    \`description\` text NOT NULL,
    \`relatedGrantId\` int,
    \`status\` enum('PENDING','UNDER_REVIEW','RESOLVED','DISMISSED') NOT NULL DEFAULT 'PENDING',
    \`resolution\` text,
    \`resolvedByUserId\` int,
    \`resolvedAt\` timestamp,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`accessChallenges_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`userPreferences\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`notifyPriorityZero\` boolean NOT NULL DEFAULT true,
    \`notifyInsights\` boolean NOT NULL DEFAULT true,
    \`notifyReminders\` boolean NOT NULL DEFAULT true,
    \`notifyMilestones\` boolean NOT NULL DEFAULT true,
    \`notifyPulseCheck\` boolean NOT NULL DEFAULT true,
    \`notifyAchievementSuggestions\` boolean NOT NULL DEFAULT true,
    \`notifyBrowserPush\` boolean NOT NULL DEFAULT false,
    \`quietHoursStart\` varchar(5) NOT NULL DEFAULT '22:00',
    \`quietHoursEnd\` varchar(5) NOT NULL DEFAULT '08:00',
    \`maxNotificationsPerDay\` int NOT NULL DEFAULT 3,
    \`onboardingCompleted\` boolean NOT NULL DEFAULT false,
    \`onboardingCompletedAt\` timestamp,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`userPreferences_id\` PRIMARY KEY(\`id\`),
    CONSTRAINT \`userPreferences_userId_unique\` UNIQUE(\`userId\`)
  )`,
  `CREATE INDEX IF NOT EXISTS \`accessGrants_tenantId_idx\` ON \`accessGrants\` (\`tenantId\`)`,
  `CREATE INDEX IF NOT EXISTS \`accessGrants_grantedByUserId_idx\` ON \`accessGrants\` (\`grantedByUserId\`)`,
  `CREATE INDEX IF NOT EXISTS \`accessGrants_status_idx\` ON \`accessGrants\` (\`status\`)`,
  `CREATE INDEX IF NOT EXISTS \`accessChallenges_tenantId_idx\` ON \`accessChallenges\` (\`tenantId\`)`,
  `CREATE INDEX IF NOT EXISTS \`accessChallenges_submittedByUserId_idx\` ON \`accessChallenges\` (\`submittedByUserId\`)`,
  `CREATE INDEX IF NOT EXISTS \`accessChallenges_status_idx\` ON \`accessChallenges\` (\`status\`)`,
  `CREATE INDEX IF NOT EXISTS \`userPreferences_userId_idx\` ON \`userPreferences\` (\`userId\`)`,
];

for (const sql of statements) {
  try {
    await conn.execute(sql);
    const tableName = sql.match(/`(\w+)`/)?.[1] ?? "statement";
    console.log(`✓ ${tableName}`);
  } catch (err) {
    if (err.code === "ER_DUP_KEYNAME" || err.code === "ER_TABLE_EXISTS_ERROR") {
      console.log(`  (already exists, skipping)`);
    } else {
      console.error(`✗ Error:`, err.message);
    }
  }
}

await conn.end();
console.log("Migration complete.");
