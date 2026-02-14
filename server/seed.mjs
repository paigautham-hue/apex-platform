#!/usr/bin/env node
/**
 * APEX Database Seeding Script
 * Creates initial tenant, org units, and sample data
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function seed() {
  console.log("🌱 Starting APEX database seeding...\n");

  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  try {
    // 1. Create default tenant
    console.log("Creating default tenant...");
    await connection.execute(`
      INSERT INTO tenants (name, slug, createdAt, updatedAt)
      VALUES ('Demo Corporation', 'demo-corp', NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = name
    `);
    
    const [tenantRows] = await connection.execute(
      "SELECT id FROM tenants WHERE slug = 'demo-corp' LIMIT 1"
    );
    const tenantId = tenantRows[0]?.id;
    
    if (!tenantId) {
      throw new Error("Failed to create tenant");
    }
    console.log(`✓ Tenant created with ID: ${tenantId}\n`);

    // 2. Create org units
    console.log("Creating organizational units...");
    
    // Group level
    await connection.execute(`
      INSERT INTO orgUnits (tenantId, name, type, businessType, parentOrgUnitId, createdAt, updatedAt)
      VALUES (?, 'Demo Group', 'HOLDING_COMPANY', 'GROWTH', NULL, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = name
    `, [tenantId]);
    
    const [groupRows] = await connection.execute(
      "SELECT id FROM orgUnits WHERE tenantId = ? AND type = 'HOLDING_COMPANY' LIMIT 1",
      [tenantId]
    );
    const groupId = groupRows[0]?.id;
    
    // Company level
    await connection.execute(`
      INSERT INTO orgUnits (tenantId, name, type, businessType, parentOrgUnitId, createdAt, updatedAt)
      VALUES (?, 'Demo Company A', 'PORTFOLIO_COMPANY', 'GROWTH', ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = name
    `, [tenantId, groupId]);
    
    const [companyRows] = await connection.execute(
      "SELECT id FROM orgUnits WHERE tenantId = ? AND type = 'PORTFOLIO_COMPANY' LIMIT 1",
      [tenantId]
    );
    const companyId = companyRows[0]?.id;
    
    // Function level
    await connection.execute(`
      INSERT INTO orgUnits (tenantId, name, type, businessType, parentOrgUnitId, createdAt, updatedAt)
      VALUES (?, 'Engineering', 'FUNCTION', 'GROWTH', ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE name = name
    `, [tenantId, companyId]);
    
    console.log(`✓ Organizational units created\n`);

    // 3. Create sample persons (will be linked to users on first login)
    console.log("Creating sample persons...");
    
    const samplePersons = [
      { name: 'John Smith', email: 'john@demo.com', title: 'CEO' },
      { name: 'Jane Doe', email: 'jane@demo.com', title: 'CTO' },
      { name: 'Bob Johnson', email: 'bob@demo.com', title: 'VP Engineering' },
    ];
    
    for (const person of samplePersons) {
      await connection.execute(`
        INSERT INTO persons (
          tenantId, name, email, hireDate, 
          dataSufficiencyLevel, evidenceCount, sourceCount,
          createdAt, updatedAt
        )
        VALUES (?, ?, ?, NOW(), 0, 0, 0, NOW(), NOW())
        ON DUPLICATE KEY UPDATE name = name
      `, [tenantId, person.name, person.email]);
    }
    
    console.log(`✓ Sample persons created\n`);

    // 4. Create sample roles
    console.log("Creating sample roles...");
    
    const [personRows] = await connection.execute(
      "SELECT id, name FROM persons WHERE tenantId = ? LIMIT 3",
      [tenantId]
    );
    
    if (personRows.length >= 3) {
      const ceoPersonId = personRows[0].id;
      const ctoPersonId = personRows[1].id;
      const vpPersonId = personRows[2].id;
      
      // CEO role
      await connection.execute(`
        INSERT INTO roles (
          tenantId, personId, orgUnitId, title, roleType,
          startDate, isActive, createdAt, updatedAt
        )
        VALUES (?, ?, ?, 'Chief Executive Officer', 'CEO', NOW(), 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE title = title
      `, [tenantId, ceoPersonId, companyId]);
      
      const [ceoRoleRows] = await connection.execute(
        "SELECT id FROM roles WHERE personId = ? AND isActive = 1 LIMIT 1",
        [ceoPersonId]
      );
      const ceoRoleId = ceoRoleRows[0]?.id;
      
      // CTO role (reports to CEO)
      await connection.execute(`
        INSERT INTO roles (
          tenantId, personId, orgUnitId, title, roleType,
          startDate, reportsToRoleId, isActive, createdAt, updatedAt
        )
        VALUES (?, ?, ?, 'Chief Technology Officer', 'CXO', NOW(), ?, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE title = title
      `, [tenantId, ctoPersonId, companyId, ceoRoleId]);
      
      const [ctoRoleRows] = await connection.execute(
        "SELECT id FROM roles WHERE personId = ? AND isActive = 1 LIMIT 1",
        [ctoPersonId]
      );
      const ctoRoleId = ctoRoleRows[0]?.id;
      
      // VP Engineering role (reports to CTO)
      await connection.execute(`
        INSERT INTO roles (
          tenantId, personId, orgUnitId, title, roleType,
          startDate, reportsToRoleId, isActive, createdAt, updatedAt
        )
        VALUES (?, ?, ?, 'VP Engineering', 'CXO_PLUS_ONE', NOW(), ?, 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE title = title
      `, [tenantId, vpPersonId, companyId, ctoRoleId]);
      
      // Update persons with current role IDs
      await connection.execute(
        "UPDATE persons SET currentRoleId = (SELECT id FROM roles WHERE personId = persons.id AND isActive = 1 LIMIT 1) WHERE tenantId = ?",
        [tenantId]
      );
      
      console.log(`✓ Sample roles created\n`);
    }

    // 5. Create sample observations
    console.log("Creating sample observations...");
    
    if (personRows.length >= 2) {
      const observerPersonId = personRows[0].id;
      const subjectPersonId = personRows[1].id;
      
      const sampleObservations = [
        {
          text: "Delivered the new API integration ahead of schedule with excellent code quality",
          direction: "POSITIVE",
          valueTags: JSON.stringify(["EXCELLENCE", "CUSTOMER_FOCUS"])
        },
        {
          text: "Proactively helped the team resolve a critical production issue",
          direction: "POSITIVE",
          valueTags: JSON.stringify(["COLLABORATION", "INTEGRITY"])
        },
        {
          text: "Needs to improve communication with stakeholders on project status",
          direction: "NEEDS_IMPROVEMENT",
          valueTags: JSON.stringify(["COLLABORATION"])
        }
      ];
      
      for (const obs of sampleObservations) {
        await connection.execute(`
          INSERT INTO observations (
            tenantId, observerPersonId, subjectPersonId,
            text, direction, valueTags, source,
            createdAt
          )
          VALUES (?, ?, ?, ?, ?, ?, 'QUICK_NOTE', NOW())
        `, [
          tenantId,
          observerPersonId,
          subjectPersonId,
          obs.text,
          obs.direction,
          obs.valueTags
        ]);
      }
      
      // Update data sufficiency
      await connection.execute(`
        UPDATE persons 
        SET evidenceCount = 3, sourceCount = 1, dataSufficiencyLevel = 1
        WHERE id = ?
      `, [subjectPersonId]);
      
      console.log(`✓ Sample observations created\n`);
    }

    // 6. Create sample plan
    console.log("Creating sample plan...");
    
    if (personRows.length >= 1) {
      const ownerPersonId = personRows[0].id;
      
      await connection.execute(`
        INSERT INTO plans (
          tenantId, ownerPersonId, orgUnitId, name, type,
          category, periodStart, periodEnd, status,
          createdAt, updatedAt
        )
        VALUES (
          ?, ?, ?, 'FY2026 Company Goals', 'BUSINESS_PLAN',
          'STRATEGIC', '2026-04-01', '2027-03-31', 'ACTIVE',
          NOW(), NOW()
        )
        ON DUPLICATE KEY UPDATE name = name
      `, [tenantId, ownerPersonId, companyId]);
      
      console.log(`✓ Sample plan created\n`);
    }

    console.log("✅ Database seeding completed successfully!");
    console.log("\nYou can now log in to APEX with any Manus account.");
    console.log("The first user to log in will be linked to the CEO person record.\n");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    await connection.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
