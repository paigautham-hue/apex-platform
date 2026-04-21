/**
 * APEX Team Data Import Script
 * - Cleans all dummy/sample data from persons, roles, orgUnits, tenants
 * - Creates Manipal Group as the holding company tenant
 * - Creates all portfolio companies as org units
 * - Imports 23 real team members from Excel data
 * - Deduplicates Sagar Mukhopadhyay (appears twice)
 */

import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// ─── Real team data from Excel ───────────────────────────────────────────────
// Row 14 is blank, row 24 is a duplicate of row 3 (Sagar) — merged below
const TEAM_MEMBERS = [
  {
    name: "Abhay Anant Gupte",
    email: "abhay.gupte@manipalgroup.info",
    phone: "9741128390",
    title: "Managing Director & Chief Executive Officer",
    company: "MTL Corporate",
    dob: "1961-05-04",
  },
  {
    name: "Pramod N Fernandes",
    email: "pramod.fernandes@manipalgroup.info",
    phone: "9845227817",
    title: "Group Chief Human Resource Officer (GCHRO)",
    company: "MTL HR",
    dob: "1955-09-11",
  },
  {
    // Merged: also listed as "President Corporate Affairs" in MTL Corporate
    name: "Sagar Mukhopadhyay",
    email: "sagar@manipalgroup.info",
    phone: "9900595332",
    title: "Managing Director & Chief Executive Officer / President Corporate Affairs",
    company: "Manipal Energy & Infratech Limited",
    dob: "1967-05-01",
  },
  {
    name: "Raghavendra Rao Sannayya",
    email: "raghavendrarao@primacyind.com",
    phone: "9845035031",
    title: "President",
    company: "Primacy Industries",
    dob: "1972-02-01",
  },
  {
    name: "Vinod Kumar",
    email: "ceo.mmnl@manipalgroup.info",
    phone: "9901332222",
    title: "Managing Director & Chief Executive Officer",
    company: "Manipal Media Network",
    dob: "1958-05-03",
  },
  {
    name: "K Girish Kini",
    email: "girish@manipalgroup.info",
    phone: "9901934858",
    title: "Chief Executive Officer - MPi",
    company: "MPi Group",
    dob: "1974-01-05",
  },
  {
    name: "Shashi Ranjan",
    email: "shashi@manipalgroup.info",
    phone: "9845398587",
    title: "Chief Executive Officer - Commercial Print",
    company: "Manipal Global Print Solutions",
    dob: "1974-08-21",
  },
  {
    name: "Guruprasad Kamath H",
    email: "guruprasad.kamath@manipalgroup.info",
    phone: "7625085843",
    title: "Chief Executive Officer - Digital Solutions",
    company: "Manipal Digital Solutions",
    dob: "1977-08-18",
  },
  {
    name: "S Sudhish Rao",
    email: "sudheesh@manipalgroup.info",
    phone: "9901938544",
    title: "Chief Executive Officer - Westtek",
    company: "Westek",
    dob: "1972-07-20",
  },
  {
    name: "Vishal Jain",
    email: "vishal.jain@manipalgroup.info",
    phone: "7838007777",
    title: "Chief Executive Officer – MBS",
    company: "MBS",
    dob: "1975-02-03",
  },
  {
    name: "Puja Abhishek Singh",
    email: "puja.singh@manipalfintech.com",
    phone: "9625573498",
    title: "Chief Executive Officer",
    company: "Manipal Fintech Private Limited",
    dob: "1978-05-27",
  },
  {
    name: "Dwijendra Acharya",
    email: "acharya@adsyndicate.in",
    phone: "9880107149",
    title: "Chief Executive Officer",
    company: "Adsyndicate",
    dob: "1968-10-17",
  },
  {
    name: "Aarti Hamsabhai Koya",
    email: "aarti.koya@aromee.in",
    phone: "9860015388",
    title: "Chief Executive Officer",
    company: "EKAM",
    dob: "1979-07-18",
  },
  {
    name: "Rajesh Shet",
    email: "rajesh.shet@manipalgroup.info",
    phone: "9845518223",
    title: "Group Business Development Officer",
    company: "MTL Corporate",
    dob: "1971-08-16",
  },
  {
    name: "Arun Bhaskar",
    email: "arunb@manipalgroup.info",
    phone: "9845243206",
    title: "Executive Vice President and Chief Information Officer",
    company: "MTL IT",
    dob: "1974-11-04",
  },
  {
    name: "Naveen Valentine Saldanha",
    email: "naveen.s@manipalgroup.info",
    phone: "9902013771",
    title: "Executive Vice President Chief Risk and Compliance Officer",
    company: "MTL Risk Management",
    dob: "1969-10-22",
  },
  {
    name: "Anand Kudigrama",
    email: "anand.kudigrama@manipalgroup.info",
    phone: "9740060986",
    title: "Director",
    company: "MTL Corporate",
    dob: "1979-10-08",
  },
  {
    name: "Mayank Bhotika",
    email: "mayank.bhotika@manipalgroup.info",
    phone: "9987892813",
    title: "Head - Strategic Finance & Treasury",
    company: "MTL Finance & Accounts",
    dob: "1986-10-19",
  },
  {
    name: "Hardur Manjunatha Dattatri",
    email: "dattatri.hm@manipalgroup.info",
    phone: "9886678080",
    title: "General Counsel",
    company: "MPi Group",
    dob: "1976-05-16",
  },
  {
    name: "Rohit Agarwal",
    email: "rohit.agarwal@manipalgroup.info",
    phone: "7995228818",
    title: "Principal",
    company: "MTL Group Strategy",
    dob: "1988-05-16",
  },
  {
    name: "Surya Sudheer Meduri",
    email: "surya.meduri@manipalgroup.info",
    phone: "9650666558",
    title: "Principal",
    company: "MTL Group Strategy",
    dob: "1989-01-15",
  },
  {
    name: "Sandeep Pandeshwara Chadaga",
    email: "sandeep.chadaga@manipalgroup.info",
    phone: "8088131857",
    title: "CFO",
    company: "MTL Corporate",
    dob: "1982-04-16",
  },
];

// Unique companies derived from the team data
const COMPANIES = [
  { name: "MTL Corporate", type: "HOLDING_COMPANY" },
  { name: "MTL HR", type: "FUNCTION" },
  { name: "MTL IT", type: "FUNCTION" },
  { name: "MTL Risk Management", type: "FUNCTION" },
  { name: "MTL Finance & Accounts", type: "FUNCTION" },
  { name: "MTL Group Strategy", type: "FUNCTION" },
  { name: "Manipal Energy & Infratech Limited", type: "PORTFOLIO_COMPANY" },
  { name: "Primacy Industries", type: "PORTFOLIO_COMPANY" },
  { name: "Manipal Media Network", type: "PORTFOLIO_COMPANY" },
  { name: "MPi Group", type: "PORTFOLIO_COMPANY" },
  { name: "Manipal Global Print Solutions", type: "PORTFOLIO_COMPANY" },
  { name: "Manipal Digital Solutions", type: "PORTFOLIO_COMPANY" },
  { name: "Westek", type: "PORTFOLIO_COMPANY" },
  { name: "MBS", type: "PORTFOLIO_COMPANY" },
  { name: "Manipal Fintech Private Limited", type: "PORTFOLIO_COMPANY" },
  { name: "Adsyndicate", type: "PORTFOLIO_COMPANY" },
  { name: "EKAM", type: "PORTFOLIO_COMPANY" },
];

// Owner emails to promote to admin
const OWNER_EMAILS = ["gpai@msn.com", "paigautham@gmail.com", "gautham@manipalgroup.info"];

async function run() {
  const conn = await mysql.createConnection(DATABASE_URL);
  console.log("✓ Connected to database");

  try {
    // ── 1. Clean up dummy/sample data ────────────────────────────────────────
    console.log("\n── Cleaning dummy/sample data ──");

    // Tables to clear in dependency order (only those that exist)
    const tablesToClear = [
      "observations",
      "plans",
      "decisions",
      "meetings",
      "calibrationSessions",
      "assessments",
      "reviews",
      "selfReflections",
      "evidence",
      "metricValues",
      "metrics",
      "financialUploads",
      "financialTemplates",
      "incentiveComputations",
      "incentiveConfigs",
      "memories",
      "notifications",
      "auditLogs",
      "accessGrants",
      "accessChallenges",
      "userPreferences",
      "persons",
      "roles",
      "orgUnits",
    ];

    for (const table of tablesToClear) {
      try {
        const [result] = await conn.execute(`DELETE FROM ${table} WHERE tenantId = 1`);
        console.log(`  ✓ Cleared ${table} (${result.affectedRows} rows)`);
      } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
          // Table doesn't have tenantId — clear all rows
          try {
            const [result] = await conn.execute(`DELETE FROM ${table}`);
            console.log(`  ✓ Cleared ${table} (no tenantId, ${result.affectedRows} rows)`);
          } catch (e2) {
            console.log(`  ⚠ Skipped ${table}: ${e2.message}`);
          }
        } else {
          console.log(`  ⚠ Skipped ${table}: ${err.message}`);
        }
      }
    }

    // ── 2. Ensure Manipal Group tenant exists ────────────────────────────────
    console.log("\n── Setting up Manipal Group tenant ──");
    const [tenantRows] = await conn.execute("SELECT id FROM tenants WHERE id = 1");
    if (tenantRows.length === 0) {
      await conn.execute(
        "INSERT INTO tenants (id, name, slug) VALUES (1, 'Manipal Group', 'manipal-group')"
      );
      console.log("  ✓ Created Manipal Group tenant");
    } else {
      await conn.execute(
        "UPDATE tenants SET name = 'Manipal Group', slug = 'manipal-group' WHERE id = 1"
      );
      console.log("  ✓ Updated tenant to Manipal Group");
    }

    // ── 3. Insert companies as org units ────────────────────────────────────
    console.log("\n── Inserting companies as org units ──");
    const orgUnitIdMap = {};
    for (const company of COMPANIES) {
      const [result] = await conn.execute(
        "INSERT INTO orgUnits (tenantId, name, type) VALUES (1, ?, ?)",
        [company.name, company.type]
      );
      orgUnitIdMap[company.name] = result.insertId;
      console.log(`  ✓ ${company.name} (${company.type}) → id=${result.insertId}`);
    }

    // ── 4. Insert team members ───────────────────────────────────────────────
    // Roles require personId (NOT NULL), so we:
    //   a) Insert person with currentRoleId = NULL
    //   b) Insert role with personId
    //   c) Update person.currentRoleId
    console.log("\n── Inserting team members ──");

    // Determine roleType from title
    function getRoleType(title) {
      const t = title.toUpperCase();
      if (t.includes("CHAIRMAN")) return "CHAIRMAN";
      if (t.includes("GROUP CEO") || t.includes("GROUP CHIEF EXECUTIVE")) return "GROUP_CEO";
      if (t.includes("GROUP CHRO") || t.includes("GROUP CHIEF HUMAN")) return "GROUP_CHRO";
      if (t.includes("CHIEF EXECUTIVE") || t.includes("MANAGING DIRECTOR")) return "CEO";
      if (t.includes("CHRO") || t.includes("CHIEF HUMAN")) return "CHRO";
      if (t.includes("CHIEF") || t.includes("CFO") || t.includes("CIO") || t.includes("CRO")) return "CXO";
      if (t.includes("PRESIDENT") || t.includes("DIRECTOR") || t.includes("GENERAL COUNSEL") || t.includes("EVP") || t.includes("EXECUTIVE VICE")) return "CXO_PLUS_ONE";
      return "CXO_PLUS_ONE";
    }

    for (const member of TEAM_MEMBERS) {
      const orgUnitId = orgUnitIdMap[member.company];
      if (!orgUnitId) {
        console.warn(`  ⚠ No org unit found for company: ${member.company} (${member.name})`);
      }

      // Step a: Insert person without currentRoleId
      // Use string date to avoid timezone conversion issues with MySQL TIMESTAMP
      const [personResult] = await conn.execute(
        `INSERT INTO persons (tenantId, name, email, phone, dataSufficiencyLevel, evidenceCount, sourceCount)
         VALUES (1, ?, ?, ?, 0, 0, 0)`,
        [member.name, member.email, member.phone]
      );
      const personId = personResult.insertId;

      // Step b: Insert role with personId
      const roleType = getRoleType(member.title);
      const startDate = "2020-01-01 00:00:00"; // default start date
      const [roleResult] = await conn.execute(
        `INSERT INTO roles (tenantId, title, personId, orgUnitId, startDate, roleType, isActive)
         VALUES (1, ?, ?, ?, ?, ?, 1)`,
        [member.title, personId, orgUnitId || 30001, startDate, roleType]
      );
      const roleId = roleResult.insertId;

      // Step c: Update person.currentRoleId
      await conn.execute(
        "UPDATE persons SET currentRoleId = ? WHERE id = ?",
        [roleId, personId]
      );

      // Set org unit leader for senior roles
      if (orgUnitId && (member.title.includes("Chief Executive") || member.title.includes("Managing Director") || member.title.includes("President"))) {
        await conn.execute(
          "UPDATE orgUnits SET leaderPersonId = ? WHERE id = ?",
          [personId, orgUnitId]
        );
      }

      console.log(`  ✓ ${member.name} [${roleType}] — ${member.title} @ ${member.company}`);
    }

    // ── 5. Promote owner emails to admin ────────────────────────────────────
    console.log("\n── Promoting owner accounts to admin ──");
    for (const email of OWNER_EMAILS) {
      const [rows] = await conn.execute("SELECT id, name FROM users WHERE email = ?", [email]);
      if (rows.length > 0) {
        await conn.execute("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
        console.log(`  ✓ Promoted ${email} (${rows[0].name}) to admin`);
      } else {
        console.log(`  ℹ ${email} not yet in users table (will be admin on first login via role check)`);
      }
    }

    // ── 6. Summary ───────────────────────────────────────────────────────────
    const [personCount] = await conn.execute("SELECT COUNT(*) as cnt FROM persons WHERE tenantId = 1");
    const [orgCount] = await conn.execute("SELECT COUNT(*) as cnt FROM orgUnits WHERE tenantId = 1");
    const [roleCount] = await conn.execute("SELECT COUNT(*) as cnt FROM roles WHERE tenantId = 1");

    console.log("\n── Import Summary ──");
    console.log(`  Persons:   ${personCount[0].cnt}`);
    console.log(`  Org Units: ${orgCount[0].cnt}`);
    console.log(`  Roles:     ${roleCount[0].cnt}`);
    console.log("\n✅ Import complete!");

  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error("❌ Import failed:", err.message);
  process.exit(1);
});
