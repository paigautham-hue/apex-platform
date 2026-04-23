import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log("Creating remaining missing tables from Claude Code schema...\n");

const tables = [
  {
    name: "feedbackTypes",
    sql: `CREATE TABLE IF NOT EXISTS feedbackTypes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      \`key\` VARCHAR(50) NOT NULL,
      label VARCHAR(100) NOT NULL,
      description TEXT,
      isBlind BOOLEAN DEFAULT FALSE,
      revealTrigger VARCHAR(100),
      isActive BOOLEAN DEFAULT TRUE,
      sortOrder INT DEFAULT 0,
      autoRevealThresholdPct INT DEFAULT 80,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX feedbackTypes_tenantId_idx (tenantId),
      INDEX feedbackTypes_key_idx (\`key\`)
    )`
  },
  {
    name: "governanceCycles",
    sql: `CREATE TABLE IF NOT EXISTS governanceCycles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      month VARCHAR(7) NOT NULL,
      status ENUM('draft','open','closed','revealed') NOT NULL DEFAULT 'draft',
      openDate TIMESTAMP NULL,
      deadlineDate TIMESTAMP NULL,
      revealDate TIMESTAMP NULL,
      createdBy INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX governanceCycles_tenantId_idx (tenantId),
      INDEX governanceCycles_month_idx (month),
      INDEX governanceCycles_status_idx (status)
    )`
  },
  {
    name: "governanceAssessments",
    sql: `CREATE TABLE IF NOT EXISTS governanceAssessments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      cycleId INT NOT NULL,
      assessorPersonId INT NOT NULL,
      targetType ENUM('person','orgUnit') NOT NULL DEFAULT 'person',
      targetId INT NOT NULL,
      dimensionKey VARCHAR(100) NOT NULL,
      feedbackTypeId INT NOT NULL,
      score INT,
      note TEXT,
      confidenceNote TEXT,
      submittedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX govAssessments_tenantId_idx (tenantId),
      INDEX govAssessments_cycleId_idx (cycleId),
      INDEX govAssessments_assessorPersonId_idx (assessorPersonId),
      INDEX govAssessments_feedbackTypeId_idx (feedbackTypeId)
    )`
  },
  {
    name: "assessmentAssignments",
    sql: `CREATE TABLE IF NOT EXISTS assessmentAssignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      cycleId INT NOT NULL,
      assessorPersonId INT NOT NULL,
      targetType ENUM('person','orgUnit') NOT NULL DEFAULT 'person',
      targetId INT NOT NULL,
      feedbackTypeId INT NOT NULL,
      status ENUM('pending','submitted','overdue') NOT NULL DEFAULT 'pending',
      dueDate TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX assessAssign_tenantId_idx (tenantId),
      INDEX assessAssign_cycleId_idx (cycleId),
      INDEX assessAssign_assessorPersonId_idx (assessorPersonId),
      INDEX assessAssign_status_idx (status)
    )`
  },
  {
    name: "mandateJournals",
    sql: `CREATE TABLE IF NOT EXISTS mandateJournals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      personId INT NOT NULL,
      cycleId INT NOT NULL,
      roleId INT,
      orgUnitId INT,
      dimensionKey VARCHAR(100) NOT NULL,
      logText TEXT,
      planText TEXT,
      planItems JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX mandateJournals_tenantId_idx (tenantId),
      INDEX mandateJournals_personId_idx (personId),
      INDEX mandateJournals_cycleId_idx (cycleId),
      INDEX mandateJournals_roleId_idx (roleId)
    )`
  },
  {
    name: "companyReflections",
    sql: `CREATE TABLE IF NOT EXISTS companyReflections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      ceoPersonId INT NOT NULL,
      cycleId INT NOT NULL,
      orgUnitId INT NOT NULL,
      wins TEXT,
      challenges TEXT,
      nextMonthPriorities TEXT,
      supportNeeded TEXT,
      overallMorale ENUM('high','medium','low') DEFAULT 'medium',
      submittedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX companyReflections_tenantId_idx (tenantId),
      INDEX companyReflections_ceoPersonId_idx (ceoPersonId),
      INDEX companyReflections_cycleId_idx (cycleId)
    )`
  },
  {
    name: "chairmanGuidance",
    sql: `CREATE TABLE IF NOT EXISTS chairmanGuidance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      chairmanPersonId INT NOT NULL,
      targetPersonId INT,
      targetOrgUnitId INT,
      cycleId INT,
      guidanceType ENUM('directive','coaching','recognition','concern','strategic') NOT NULL DEFAULT 'coaching',
      content TEXT NOT NULL,
      isPrivate BOOLEAN DEFAULT FALSE,
      acknowledgedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX chairmanGuidance_tenantId_idx (tenantId),
      INDEX chairmanGuidance_chairmanPersonId_idx (chairmanPersonId),
      INDEX chairmanGuidance_targetPersonId_idx (targetPersonId)
    )`
  },
  {
    name: "dependencyChains",
    sql: `CREATE TABLE IF NOT EXISTS dependencyChains (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenantId INT NOT NULL,
      fromPersonId INT NOT NULL,
      toPersonId INT NOT NULL,
      dependencyType ENUM('blocks','enables','informs','escalates') NOT NULL DEFAULT 'blocks',
      description TEXT,
      status ENUM('active','resolved','monitoring') NOT NULL DEFAULT 'active',
      resolvedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX dependencyChains_tenantId_idx (tenantId),
      INDEX dependencyChains_fromPersonId_idx (fromPersonId),
      INDEX dependencyChains_toPersonId_idx (toPersonId)
    )`
  },
];

const [existingTablesRows] = await conn.execute("SHOW TABLES");
const existingTables = existingTablesRows.map(r => Object.values(r)[0]);

for (const { name, sql } of tables) {
  if (!existingTables.includes(name)) {
    await conn.execute(sql);
    console.log(`✅ Created: ${name}`);
  } else {
    console.log(`⏭ Already exists: ${name}`);
  }
}

await conn.end();
console.log("\n✅ All remaining tables migrated!");
