import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Show existing tables
const [tables] = await conn.execute("SHOW TABLES");
const existingTables = tables.map(r => Object.values(r)[0]);
console.log("Existing tables:", existingTables);

// 1. Add missing columns to userPreferences
console.log("\n--- Migrating userPreferences ---");
const [cols] = await conn.execute("SHOW COLUMNS FROM userPreferences");
const existingCols = cols.map(c => c.Field);
console.log("Existing columns:", existingCols);

const newCols = [
  { name: "defaultLandingPath", sql: "ALTER TABLE userPreferences ADD COLUMN defaultLandingPath ENUM('me','team','group','today') NOT NULL DEFAULT 'me'" },
  { name: "voiceFirstCapture", sql: "ALTER TABLE userPreferences ADD COLUMN voiceFirstCapture BOOLEAN NOT NULL DEFAULT TRUE" },
  { name: "dailyFocusEnabled", sql: "ALTER TABLE userPreferences ADD COLUMN dailyFocusEnabled BOOLEAN NOT NULL DEFAULT TRUE" },
  { name: "weeklyPulseEnabled", sql: "ALTER TABLE userPreferences ADD COLUMN weeklyPulseEnabled BOOLEAN NOT NULL DEFAULT TRUE" },
  { name: "preferredVoiceLocale", sql: "ALTER TABLE userPreferences ADD COLUMN preferredVoiceLocale VARCHAR(10) NOT NULL DEFAULT 'en-IN'" },
];

for (const col of newCols) {
  if (!existingCols.includes(col.name)) {
    await conn.execute(col.sql);
    console.log(`✅ Added column: ${col.name}`);
  } else {
    console.log(`⏭ Already exists: ${col.name}`);
  }
}

// 2. Create missing tables from Claude Code
const tablesToCreate = {
  entryViews: `CREATE TABLE IF NOT EXISTS entryViews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenantId INT NOT NULL,
    viewerPersonId INT NOT NULL,
    entityType VARCHAR(50) NOT NULL,
    entityId INT NOT NULL,
    ownerPersonId INT NOT NULL,
    viewedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX entryViews_tenantId_idx (tenantId),
    INDEX entryViews_ownerPersonId_idx (ownerPersonId)
  )`,
  dailyFocusLog: `CREATE TABLE IF NOT EXISTS dailyFocusLog (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    tenantId INT NOT NULL,
    personId INT NOT NULL,
    date DATE NOT NULL,
    focusPersonId INT,
    focusNote TEXT,
    completedAt TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX dailyFocusLog_userId_idx (userId),
    INDEX dailyFocusLog_tenantId_idx (tenantId)
  )`,
  voiceSessions: `CREATE TABLE IF NOT EXISTS voiceSessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    tenantId INT NOT NULL,
    personId INT NOT NULL,
    audioUrl VARCHAR(500),
    transcript TEXT,
    intentClassification VARCHAR(100),
    linkedEntityType VARCHAR(50),
    linkedEntityId INT,
    durationSeconds INT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX voiceSessions_userId_idx (userId),
    INDEX voiceSessions_tenantId_idx (tenantId)
  )`,
  agenticMemories: `CREATE TABLE IF NOT EXISTS agenticMemories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    tenantId INT NOT NULL,
    personId INT NOT NULL,
    memoryType VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT,
    relevanceScore FLOAT DEFAULT 0,
    expiresAt TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX agenticMemories_userId_idx (userId),
    INDEX agenticMemories_tenantId_idx (tenantId)
  )`,
  aiPersonaConfigs: `CREATE TABLE IF NOT EXISTS aiPersonaConfigs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL UNIQUE,
    tenantId INT NOT NULL,
    personId INT NOT NULL,
    personaName VARCHAR(100) NOT NULL DEFAULT 'APEX',
    tone VARCHAR(50) NOT NULL DEFAULT 'professional',
    verbosity VARCHAR(50) NOT NULL DEFAULT 'concise',
    focusAreas TEXT,
    customInstructions TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    INDEX aiPersonaConfigs_userId_idx (userId)
  )`,
  aiDeliberations: `CREATE TABLE IF NOT EXISTS aiDeliberations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    tenantId INT NOT NULL,
    personId INT NOT NULL,
    topic VARCHAR(500) NOT NULL,
    context TEXT,
    perspectives TEXT,
    synthesis TEXT,
    recommendation TEXT,
    confidence FLOAT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX aiDeliberations_userId_idx (userId),
    INDEX aiDeliberations_tenantId_idx (tenantId)
  )`,
  calendarTokens: `CREATE TABLE IF NOT EXISTS calendarTokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL DEFAULT 'google',
    accessToken TEXT NOT NULL,
    refreshToken TEXT,
    expiresAt TIMESTAMP,
    scope TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    INDEX calendarTokens_userId_idx (userId)
  )`,
  calendarEvents: `CREATE TABLE IF NOT EXISTS calendarEvents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    tenantId INT NOT NULL,
    externalId VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    startTime TIMESTAMP NOT NULL,
    endTime TIMESTAMP NOT NULL,
    attendees TEXT,
    meetingId INT,
    syncedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX calendarEvents_userId_idx (userId),
    INDEX calendarEvents_tenantId_idx (tenantId)
  )`,
  shareLinks: `CREATE TABLE IF NOT EXISTS shareLinks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    tenantId INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    entityType VARCHAR(50) NOT NULL,
    entityId INT NOT NULL,
    expiresAt TIMESTAMP,
    viewCount INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX shareLinks_token_idx (token),
    INDEX shareLinks_userId_idx (userId)
  )`,
};

console.log("\n--- Creating missing tables ---");
for (const [tableName, sql] of Object.entries(tablesToCreate)) {
  if (!existingTables.includes(tableName)) {
    await conn.execute(sql);
    console.log(`✅ Created table: ${tableName}`);
  } else {
    console.log(`⏭ Already exists: ${tableName}`);
  }
}

// 3. Check for other new tables that might need creation
const newSchemaTablesNeeded = [
  "selfReflections", "memories", "mandateJournals", "companyReflections",
  "chairmanGuidance", "dependencyChains", "feedbackTypes", "governanceCycles",
  "governanceAssessments", "assessmentAssignments"
];

console.log("\n--- Checking other tables ---");
for (const t of newSchemaTablesNeeded) {
  if (!existingTables.includes(t)) {
    console.log(`⚠️  Missing table: ${t} (needs manual migration)`);
  } else {
    console.log(`✅ Exists: ${t}`);
  }
}

await conn.end();
console.log("\n✅ Migration complete!");
