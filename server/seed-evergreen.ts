/**
 * Evergreen Fund seed script (Phase 1.9)
 *
 * Idempotent: safe to run multiple times. Each entity is looked up by a
 * natural key (name, slug, title+personId) and only inserted if missing.
 *
 * Run with:  pnpm seed:evergreen
 *
 * Requires DATABASE_URL in env.
 */

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  tenants,
  users,
  persons,
  orgUnits,
  roles,
  plans,
  metrics,
  metricValues,
  dependencyChains,
  feedbackTypes,
} from "../drizzle/schema";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("[seed] DATABASE_URL not set. Abort.");
  process.exit(1);
}
const db = drizzle(DB_URL);

// Data: Evergreen Fund roster + portfolio + chains + feedback types
const TENANT = { name: "Manipal Evergreen Fund", slug: "mef" };

type CXOType = "CHAIRMAN" | "GROUP_CEO" | "GROUP_CHRO" | "CXO" | "CXO_PLUS_ONE" | "CHRO";
type AllRoleType = CXOType | "CEO" | "BOARD_MEMBER";

const CXOS: Array<{ name: string; email: string; title: string; roleType: CXOType; mandates: string[] }> = [
  {
    name: "Gautham Pai", email: "gautham.pai@mef.in", title: "Executive Chairman", roleType: "CHAIRMAN",
    mandates: [
      "Set fund strategy and long-term vision",
      "Govern portfolio capital allocation",
      "Cultivate board and investor relationships",
      "Protect and evolve fund values and culture",
      "Chair monthly governance and calibration",
      "Develop CXO and CEO bench",
      "Represent the fund in public and regulatory forums",
    ],
  },
  {
    name: "Abhay Anant Gupte", email: "abhay.gupte@mef.in", title: "Managing Director", roleType: "GROUP_CEO",
    mandates: [
      "Deliver FY27 portfolio financial plan",
      "Run weekly CEO operating rhythm",
      "Unblock CEOs and sequence cross-portfolio priorities",
      "Own group-level P&L commitments",
      "Coach and develop portfolio CEOs",
      "Escalate and resolve cross-company dependencies",
      "Report fund performance to Chairman and Board",
    ],
  },
  {
    name: "Anand Kudigrama", email: "anand.kudigrama@mef.in", title: "Chief of Staff", roleType: "CXO",
    mandates: [
      "Prepare Chairman and MD operating cadence",
      "Track portfolio-wide commitments and follow-ups",
      "Draft and socialise strategic memos",
      "Coordinate quarterly board packs",
      "Manage cross-CXO initiatives",
      "Own internal communications to the fleet",
      "Run the monthly governance cycle operations",
      "Synthesize fund-wide insights from observations",
    ],
  },
  {
    name: "Sandeep P. Chadaga", email: "sandeep.chadaga@mef.in", title: "Chief Financial Officer", roleType: "CXO",
    mandates: [
      "Close FY27 budget with all 13 companies",
      "Deliver monthly MIS within 5 working days",
      "Maintain cash runway visibility across portfolio",
      "Lead statutory and internal audit readiness",
      "Own treasury and banking relationships",
      "Partner with CEOs on variance analysis",
      "Ensure tax and regulatory compliance group-wide",
      "Drive working-capital optimization initiatives",
      "Approve capital expenditure above threshold",
      "Govern inter-company pricing and allocations",
      "Maintain debt covenants and lender reporting",
    ],
  },
  {
    name: "Mayank Bhotika", email: "mayank.bhotika@mef.in", title: "Strategic Finance", roleType: "CXO",
    mandates: [
      "Build and maintain portfolio valuation models",
      "Evaluate bolt-on acquisitions and divestitures",
      "Run FY27 planning and scenario modelling",
      "Analyse capital allocation trade-offs",
      "Support CBDO on M&A diligence",
      "Maintain competitive benchmarking dossiers",
      "Translate strategy into financial commitments",
      "Advise CEOs on unit economics",
      "Run post-mortems on capital decisions",
    ],
  },
  {
    name: "Naveen V. Saldanha", email: "naveen.saldanha@mef.in", title: "Chief Risk Officer", roleType: "CXO",
    mandates: [
      "Maintain fund-wide risk register",
      "Review portfolio company risk posture quarterly",
      "Escalate chronic risks to MD and Chairman",
      "Own enterprise risk framework",
      "Partner with Legal on compliance risks",
      "Lead crisis response playbooks",
      "Govern cybersecurity risk reviews",
    ],
  },
  {
    name: "Arun Bhaskar", email: "arun.bhaskar@mef.in", title: "Chief Digital Officer", roleType: "CXO",
    mandates: [
      "Deliver portfolio-wide digital roadmap",
      "Operate APEX and the governance stack",
      "Land AI use cases inside portfolio companies",
      "Maintain shared data platforms",
      "Champion digital talent strategy",
      "Report digital maturity quarterly",
    ],
  },
  {
    name: "Rajesh Shet", email: "rajesh.shet@mef.in", title: "Chief Business Development Officer", roleType: "CXO",
    mandates: [
      "Pipeline and close strategic partnerships",
      "Run M&A origination across sectors",
      "Support CEOs on top-10 customer wins",
      "Build investor and JV relationships",
      "Steward the brand and positioning of the fund",
      "Operate the deal review forum",
    ],
  },
  {
    name: "Strategy Lead", email: "strategy@mef.in", title: "Head of Strategy", roleType: "CXO",
    mandates: [
      "Refresh portfolio strategy annually",
      "Run external scans and opportunity radar",
      "Challenge CEO strategic plans",
      "Facilitate annual strategy offsite",
      "Maintain strategic operating model",
      "Support Chairman on thesis evolution",
      "Partner with StratFin on model inputs",
    ],
  },
  {
    name: "Pramod N. Fernandes", email: "pramod.fernandes@mef.in", title: "Chief Human Resources Officer", roleType: "GROUP_CHRO",
    mandates: [
      "Hit portfolio hiring plan for FY27",
      "Design and run CXO/CEO succession pipeline",
      "Lead performance and calibration cycles",
      "Maintain compensation and incentive design",
      "Steward fund-wide culture and values",
      "Run leadership development programs",
      "Partner with CEOs on organization design",
      "Operate employee listening and pulse",
      "Govern policy and HR compliance",
    ],
  },
  {
    name: "Sagar", email: "sagar.corp@mef.in", title: "Head of Corporate Affairs", roleType: "CXO",
    mandates: [
      "Manage stakeholder and government relations",
      "Run external communications calendar",
      "Steward brand and public narrative",
      "Coordinate CSR and impact reporting",
      "Partner with Legal on regulatory filings",
    ],
  },
  {
    name: "Hardur M. Dattatri", email: "hardur.dattatri@mef.in", title: "General Counsel", roleType: "CXO",
    mandates: [
      "Advise Board on governance matters",
      "Own contract review and standard templates",
      "Lead M&A and partnership legal workstreams",
      "Manage litigation and dispute resolution",
      "Ensure corporate and statutory compliance",
      "Steward data-privacy and IP strategy",
      "Partner with CRO on risk and controls",
    ],
  },
];

const COMPANIES: Array<{
  name: string;
  sector: string;
  revFY26: number;
  revFY27: number;
  ebitdaFY27: number;
  pbtFY27: number;
  ceoName: string;
  ceoEmail: string;
  stage: "GROWTH" | "HARVEST" | "INCUBATE";
}> = [
  { name: "MPI (Cards & Identity)", sector: "Cards & Identity", revFY26: 1550, revFY27: 1800, ebitdaFY27: 270, pbtFY27: 180, ceoName: "K Girish Kini", ceoEmail: "girish.kini@mpi.in", stage: "GROWTH" },
  { name: "Goose Creek", sector: "Candles & Fragrance", revFY26: 890, revFY27: 935, ebitdaFY27: 168, pbtFY27: 110, ceoName: "Goose Creek CEO", ceoEmail: "ceo@goosecreek.com", stage: "HARVEST" },
  { name: "MGPS", sector: "Printing & Publishing", revFY26: 520, revFY27: 590, ebitdaFY27: 75, pbtFY27: 48, ceoName: "Shashi Ranjan", ceoEmail: "shashi.ranjan@mgps.in", stage: "GROWTH" },
  { name: "Primacy", sector: "Packaging", revFY26: 510, revFY27: 600, ebitdaFY27: 90, pbtFY27: 60, ceoName: "Raghavendra Rao", ceoEmail: "raghavendra.rao@primacy.in", stage: "GROWTH" },
  { name: "Westtek", sector: "Inks & Chemicals", revFY26: 70, revFY27: 90, ebitdaFY27: 9, pbtFY27: 5, ceoName: "Westtek CEO", ceoEmail: "ceo@westtek.in", stage: "INCUBATE" },
  { name: "Ascense", sector: "Candles US", revFY26: 110, revFY27: 130, ebitdaFY27: 10, pbtFY27: 4, ceoName: "Ascense CEO", ceoEmail: "ceo@ascense.com", stage: "HARVEST" },
  { name: "MBS", sector: "BFSI BPO", revFY26: 210, revFY27: 265, ebitdaFY27: 40, pbtFY27: 28, ceoName: "Vishal Jain", ceoEmail: "vishal.jain@mbs.in", stage: "GROWTH" },
  { name: "AdSyndicate", sector: "Advertising", revFY26: 140, revFY27: 175, ebitdaFY27: 21, pbtFY27: 14, ceoName: "Dwijendra Acharya", ceoEmail: "dwijendra.acharya@adsyndicate.in", stage: "GROWTH" },
  { name: "MMNL", sector: "Media", revFY26: 180, revFY27: 200, ebitdaFY27: 30, pbtFY27: 20, ceoName: "Vinod Kumar", ceoEmail: "vinod.kumar@mmnl.in", stage: "HARVEST" },
  { name: "MFPL", sector: "Gold Loan", revFY26: 95, revFY27: 125, ebitdaFY27: 20, pbtFY27: 13, ceoName: "Puja Singh", ceoEmail: "puja.singh@mfpl.in", stage: "INCUBATE" },
  { name: "MDS", sector: "Creative Production", revFY26: 80, revFY27: 96, ebitdaFY27: 12, pbtFY27: 8, ceoName: "Guruprasad Kamath", ceoEmail: "guruprasad.kamath@mds.in", stage: "GROWTH" },
  { name: "EKAM", sector: "D2C Fragrance", revFY26: 8, revFY27: 15, ebitdaFY27: 1, pbtFY27: 0, ceoName: "Aarti Koya", ceoEmail: "aarti.koya@ekam.in", stage: "INCUBATE" },
  { name: "CrossFraud", sector: "RegTech", revFY26: 6, revFY27: 13, ebitdaFY27: 1, pbtFY27: 0, ceoName: "Dhiren", ceoEmail: "dhiren@crossfraud.in", stage: "INCUBATE" },
];

const CEO_MANDATES = [
  "Deliver FY27 revenue and EBITDA budget",
  "Run monthly operating review with MD",
  "Hit hiring and retention plan for FY27",
  "Deliver top-3 strategic initiatives",
  "Maintain customer health and concentration risk",
  "Protect working capital and cash conversion",
  "Cultivate the leadership team beneath you",
];

const CHAINS = [
  { name: "Financial Truth", color: "#FFB800", description: "CFO -> StratFin -> CRO -> MD -> Chairman" },
  { name: "Growth Engine", color: "#00D4AA", description: "Strategy -> CBDO -> StratFin -> MD -> CEOs" },
  { name: "Governance Shield", color: "#FF4757", description: "CRO -> CFO -> Legal -> CorpAffairs -> Chairman" },
  { name: "Talent Loop", color: "#A78BFA", description: "CHRO -> MD -> CEOs -> Chairman" },
  { name: "Intelligence Nervous System", color: "#2ED573", description: "Digital -> CFO -> Strategy -> MD -> Chairman" },
];

const CHAIN_TITLES: Record<string, string[]> = {
  "Financial Truth": ["Chief Financial Officer", "Strategic Finance", "Chief Risk Officer", "Managing Director", "Executive Chairman"],
  "Growth Engine": ["Head of Strategy", "Chief Business Development Officer", "Strategic Finance", "Managing Director"],
  "Governance Shield": ["Chief Risk Officer", "Chief Financial Officer", "General Counsel", "Head of Corporate Affairs", "Executive Chairman"],
  "Talent Loop": ["Chief Human Resources Officer", "Managing Director", "Executive Chairman"],
  "Intelligence Nervous System": ["Chief Digital Officer", "Chief Financial Officer", "Head of Strategy", "Managing Director", "Executive Chairman"],
};

const FEEDBACK_TYPES = [
  { key: "self", label: "Self Assessment", cadence: "MONTHLY" as const, visibilityRule: "IMMEDIATE" as const, isBlind: false, sortOrder: 1 },
  { key: "chairman", label: "Chairman Assessment", cadence: "MONTHLY" as const, visibilityRule: "AFTER_ALL_SUBMIT" as const, isBlind: false, sortOrder: 2 },
  { key: "md", label: "MD Assessment", cadence: "MONTHLY" as const, visibilityRule: "AFTER_ALL_SUBMIT" as const, isBlind: false, sortOrder: 3 },
];

// Helpers --------------------------------------------------------------------

async function upsertTenant() {
  const existing = await db.select().from(tenants).where(eq(tenants.slug, TENANT.slug)).limit(1);
  if (existing.length > 0) return existing[0];
  await db.insert(tenants).values(TENANT);
  const row = await db.select().from(tenants).where(eq(tenants.slug, TENANT.slug)).limit(1);
  return row[0];
}

async function upsertUserAndPerson(tenantId: number, name: string, email: string): Promise<number> {
  const openId = `seed:${email}`;
  let userId: number;
  const existingUser = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (existingUser.length > 0) {
    userId = existingUser[0].id;
  } else {
    await db.insert(users).values({ openId, name, email, loginMethod: "SEED" });
    const row = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    userId = row[0].id;
  }

  const existingPerson = await db
    .select()
    .from(persons)
    .where(and(eq(persons.tenantId, tenantId), eq(persons.userId, userId)))
    .limit(1);
  if (existingPerson.length > 0) return existingPerson[0].id;
  await db.insert(persons).values({ tenantId, userId, name, email });
  const row = await db
    .select()
    .from(persons)
    .where(and(eq(persons.tenantId, tenantId), eq(persons.userId, userId)))
    .limit(1);
  return row[0].id;
}

async function upsertOrgUnit(
  tenantId: number,
  config: {
    name: string;
    type: "HOLDING_COMPANY" | "PORTFOLIO_COMPANY" | "FUNCTION" | "TEAM" | "SUB_BUSINESS";
    parentOrgUnitId: number | null;
    businessType?: "GROWTH" | "HARVEST" | "INCUBATE";
    leaderPersonId?: number | null;
  },
): Promise<number> {
  const existing = await db
    .select()
    .from(orgUnits)
    .where(and(eq(orgUnits.tenantId, tenantId), eq(orgUnits.name, config.name)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  await db.insert(orgUnits).values({
    tenantId,
    name: config.name,
    type: config.type,
    parentOrgUnitId: config.parentOrgUnitId,
    businessType: config.businessType,
    leaderPersonId: config.leaderPersonId ?? null,
  });
  const row = await db
    .select()
    .from(orgUnits)
    .where(and(eq(orgUnits.tenantId, tenantId), eq(orgUnits.name, config.name)))
    .limit(1);
  return row[0].id;
}

async function upsertRole(
  tenantId: number,
  config: {
    title: string;
    personId: number;
    orgUnitId: number;
    roleType: AllRoleType;
    successMetrics: string[];
  },
): Promise<number> {
  const existing = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.tenantId, tenantId),
        eq(roles.title, config.title),
        eq(roles.personId, config.personId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(roles)
      .set({
        successMetrics: config.successMetrics,
        orgUnitId: config.orgUnitId,
        roleType: config.roleType,
      })
      .where(eq(roles.id, existing[0].id));
    await db.update(persons).set({ currentRoleId: existing[0].id }).where(eq(persons.id, config.personId));
    return existing[0].id;
  }
  await db.insert(roles).values({
    tenantId,
    title: config.title,
    personId: config.personId,
    orgUnitId: config.orgUnitId,
    startDate: new Date(),
    roleType: config.roleType,
    successMetrics: config.successMetrics,
    isActive: true,
  });
  const row = await db
    .select()
    .from(roles)
    .where(
      and(
        eq(roles.tenantId, tenantId),
        eq(roles.title, config.title),
        eq(roles.personId, config.personId),
      ),
    )
    .limit(1);
  await db.update(persons).set({ currentRoleId: row[0].id }).where(eq(persons.id, config.personId));
  return row[0].id;
}

async function upsertChain(
  tenantId: number,
  name: string,
  color: string,
  description: string,
  nodeRoleIds: number[],
  sortOrder: number,
) {
  const existing = await db
    .select()
    .from(dependencyChains)
    .where(and(eq(dependencyChains.tenantId, tenantId), eq(dependencyChains.name, name)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(dependencyChains)
      .set({ nodeRoleIds, color, description, sortOrder })
      .where(eq(dependencyChains.id, existing[0].id));
    return existing[0].id;
  }
  await db.insert(dependencyChains).values({ tenantId, name, color, description, nodeRoleIds, sortOrder });
  return null;
}

async function upsertFeedbackType(tenantId: number, t: typeof FEEDBACK_TYPES[number]) {
  const existing = await db
    .select()
    .from(feedbackTypes)
    .where(and(eq(feedbackTypes.tenantId, tenantId), eq(feedbackTypes.key, t.key)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  await db.insert(feedbackTypes).values({
    tenantId,
    key: t.key,
    label: t.label,
    cadence: t.cadence,
    visibilityRule: t.visibilityRule,
    isBlind: t.isBlind,
    sortOrder: t.sortOrder,
    isActive: true,
  });
  return null;
}

async function upsertFinancialPlan(
  tenantId: number,
  orgUnitId: number,
  ownerPersonId: number,
  name: string,
) {
  const existing = await db
    .select()
    .from(plans)
    .where(and(eq(plans.tenantId, tenantId), eq(plans.orgUnitId, orgUnitId), eq(plans.name, name)))
    .limit(1);
  if (existing.length > 0) return existing[0].id;
  await db.insert(plans).values({
    tenantId,
    name,
    type: "BUSINESS_PLAN",
    ownerPersonId,
    orgUnitId,
    category: "FINANCIAL",
    periodStart: new Date("2026-04-01"),
    periodEnd: new Date("2027-03-31"),
    status: "ACTIVE",
  });
  const row = await db
    .select()
    .from(plans)
    .where(and(eq(plans.tenantId, tenantId), eq(plans.orgUnitId, orgUnitId), eq(plans.name, name)))
    .limit(1);
  return row[0].id;
}

async function upsertMetric(
  tenantId: number,
  planId: number,
  name: string,
  targetValue: number,
  ownerPersonId: number,
) {
  const existing = await db
    .select()
    .from(metrics)
    .where(and(eq(metrics.tenantId, tenantId), eq(metrics.planId, planId), eq(metrics.name, name)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(metrics)
      .set({ targetValue: String(targetValue) })
      .where(eq(metrics.id, existing[0].id));
    return existing[0].id;
  }
  await db.insert(metrics).values({
    tenantId,
    planId,
    name,
    definition: `${name} target for the fiscal year (Rs Cr)`,
    targetValue: String(targetValue),
    updateCadence: "QUARTERLY",
    ownerPersonId,
  });
  const row = await db
    .select()
    .from(metrics)
    .where(and(eq(metrics.tenantId, tenantId), eq(metrics.planId, planId), eq(metrics.name, name)))
    .limit(1);
  return row[0].id;
}

async function upsertAnnualMetricValue(
  metricId: number,
  periodDate: Date,
  targetValue: number,
  actualValue: number,
) {
  const existing = await db
    .select()
    .from(metricValues)
    .where(and(eq(metricValues.metricId, metricId), eq(metricValues.periodType, "ANNUAL")))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(metricValues)
      .set({ targetValue: String(targetValue), actualValue: String(actualValue), periodDate })
      .where(eq(metricValues.id, existing[0].id));
    return;
  }
  await db.insert(metricValues).values({
    metricId,
    periodDate,
    periodType: "ANNUAL",
    targetValue: String(targetValue),
    actualValue: String(actualValue),
  });
}

// Main -----------------------------------------------------------------------

async function main() {
  console.log("[seed] Evergreen Fund seed starting...");

  const tenant = await upsertTenant();
  const tenantId = tenant.id;
  console.log(`[seed] Tenant: ${tenant.name} (#${tenantId})`);

  const holdingId = await upsertOrgUnit(tenantId, {
    name: "Manipal Evergreen Fund (Holding)",
    type: "HOLDING_COMPANY",
    parentOrgUnitId: null,
  });
  console.log(`[seed] Holding company #${holdingId}`);

  // CXO persons + roles
  const cxoTitleToRoleId = new Map<string, number>();
  for (const cxo of CXOS) {
    const personId = await upsertUserAndPerson(tenantId, cxo.name, cxo.email);
    const roleId = await upsertRole(tenantId, {
      title: cxo.title,
      personId,
      orgUnitId: holdingId,
      roleType: cxo.roleType,
      successMetrics: cxo.mandates,
    });
    cxoTitleToRoleId.set(cxo.title, roleId);
    console.log(`[seed]   CXO ${cxo.title} -> person #${personId}, role #${roleId}`);
  }

  // Portfolio companies + CEOs + FY27 financials
  const cfo = CXOS.find((c) => c.title === "Chief Financial Officer")!;
  const cfoPersonId = await upsertUserAndPerson(tenantId, cfo.name, cfo.email);
  for (const company of COMPANIES) {
    const orgUnitId = await upsertOrgUnit(tenantId, {
      name: company.name,
      type: "PORTFOLIO_COMPANY",
      parentOrgUnitId: holdingId,
      businessType: company.stage,
    });

    const ceoPersonId = await upsertUserAndPerson(tenantId, company.ceoName, company.ceoEmail);
    const ceoRoleId = await upsertRole(tenantId, {
      title: `CEO - ${company.name}`,
      personId: ceoPersonId,
      orgUnitId,
      roleType: "CEO",
      successMetrics: CEO_MANDATES,
    });

    await db.update(orgUnits).set({ leaderPersonId: ceoPersonId }).where(eq(orgUnits.id, orgUnitId));

    const planId = await upsertFinancialPlan(tenantId, orgUnitId, ceoPersonId, `FY27 Financial Plan - ${company.name}`);

    const metricConfigs = [
      { name: "Revenue FY26", target: company.revFY26, actual: company.revFY26, periodDate: new Date("2026-03-31") },
      { name: "Revenue FY27", target: company.revFY27, actual: 0, periodDate: new Date("2027-03-31") },
      { name: "EBITDA FY27", target: company.ebitdaFY27, actual: 0, periodDate: new Date("2027-03-31") },
      { name: "PBT FY27", target: company.pbtFY27, actual: 0, periodDate: new Date("2027-03-31") },
    ];
    for (const m of metricConfigs) {
      const metricId = await upsertMetric(tenantId, planId, m.name, m.target, cfoPersonId);
      await upsertAnnualMetricValue(metricId, m.periodDate, m.target, m.actual);
    }

    console.log(`[seed]   Company ${company.name} -> org #${orgUnitId}, CEO role #${ceoRoleId}`);
  }

  // Dependency chains
  let chainOrder = 0;
  for (const chain of CHAINS) {
    const memberTitles = CHAIN_TITLES[chain.name] ?? [];
    const nodeRoleIds = memberTitles
      .map((t) => cxoTitleToRoleId.get(t))
      .filter((x): x is number => typeof x === "number");
    await upsertChain(tenantId, chain.name, chain.color, chain.description, nodeRoleIds, chainOrder++);
    console.log(`[seed]   Chain ${chain.name} -> ${nodeRoleIds.length} roles`);
  }

  // Feedback types
  for (const t of FEEDBACK_TYPES) {
    await upsertFeedbackType(tenantId, t);
  }
  console.log(`[seed]   Feedback types: ${FEEDBACK_TYPES.map((t) => t.key).join(", ")}`);

  console.log("[seed] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
