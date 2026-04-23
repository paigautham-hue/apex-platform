/**
 * APEX Scope Resolver — the fractal keystone.
 *
 * Every page (/me, /team, /group), every router, every AI prompt, and every
 * insight surface uses this module to answer: "what can THIS viewer see?"
 *
 * Tier ladder (highest → lowest authority):
 *   CHAIRMAN > GROUP_CEO > CEO/CXO > CXO_PLUS_ONE > MEMBER
 *
 * Default landing path:
 *   tier=CHAIRMAN/GROUP_CEO  → "group"
 *   tier=CEO/CXO              → "team"
 *   anyone with no reports    → "me"
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import { orgUnits, persons, roles, type Person, type Role, type OrgUnit } from "../drizzle/schema";

export type ViewerTier = "CHAIRMAN" | "GROUP_CEO" | "CEO" | "CXO" | "MEMBER";
export type LandingPath = "me" | "team" | "group" | "today";

export interface ViewerScope {
  person: Person;
  primaryRole: Role | null;
  allRoles: Role[];
  tier: ViewerTier;
  defaultLanding: LandingPath;
  // Org units this viewer "leads" (directly or transitively)
  ownedOrgUnitIds: number[];
  // Person IDs that report to this viewer (direct + transitive)
  subordinatePersonIds: number[];
  // Direct reports only
  directReportPersonIds: number[];
  // Can this viewer see the entire fund?
  isFundWide: boolean;
}

/**
 * Map a roleType to a viewer tier.
 */
export function roleTypeToTier(roleType: string | null | undefined): ViewerTier {
  switch (roleType) {
    case "CHAIRMAN":
      return "CHAIRMAN";
    case "GROUP_CEO":
    case "GROUP_CHRO":
      return "GROUP_CEO";
    case "CEO":
      return "CEO";
    case "CXO":
    case "CHRO":
    case "BOARD_MEMBER":
      return "CXO";
    case "CXO_PLUS_ONE":
    default:
      return "MEMBER";
  }
}

/**
 * Default landing path from tier.
 */
export function landingForTier(tier: ViewerTier, hasReports: boolean): LandingPath {
  if (tier === "CHAIRMAN" || tier === "GROUP_CEO") return "group";
  if (hasReports) return "team";
  return "me";
}

/**
 * Recursively walk the org tree to gather all descendant orgUnit IDs.
 */
async function descendantOrgUnitIds(rootIds: number[], allUnits: OrgUnit[]): Promise<number[]> {
  const byParent = new Map<number, OrgUnit[]>();
  for (const u of allUnits) {
    if (u.parentOrgUnitId == null) continue;
    if (!byParent.has(u.parentOrgUnitId)) byParent.set(u.parentOrgUnitId, []);
    byParent.get(u.parentOrgUnitId)!.push(u);
  }
  const out = new Set<number>(rootIds);
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.shift()!;
    const kids = byParent.get(id) ?? [];
    for (const k of kids) {
      if (!out.has(k.id)) {
        out.add(k.id);
        queue.push(k.id);
      }
    }
  }
  return Array.from(out);
}

/**
 * Recursively gather subordinate person IDs by walking roles.reportsToRoleId.
 */
function transitiveReports(
  rootRoleIds: number[],
  allRoles: Role[]
): { roleIds: number[]; personIds: number[]; directPersonIds: number[] } {
  const reportsToMap = new Map<number, Role[]>();
  for (const r of allRoles) {
    if (r.reportsToRoleId == null) continue;
    if (!reportsToMap.has(r.reportsToRoleId)) reportsToMap.set(r.reportsToRoleId, []);
    reportsToMap.get(r.reportsToRoleId)!.push(r);
  }

  const directRoles: Role[] = [];
  for (const id of rootRoleIds) {
    directRoles.push(...(reportsToMap.get(id) ?? []));
  }
  const directPersonIds = Array.from(new Set(directRoles.map(r => r.personId)));

  const allRoleIds = new Set<number>();
  const queue = [...rootRoleIds];
  while (queue.length) {
    const id = queue.shift()!;
    const kids = reportsToMap.get(id) ?? [];
    for (const k of kids) {
      if (!allRoleIds.has(k.id)) {
        allRoleIds.add(k.id);
        queue.push(k.id);
      }
    }
  }
  const personIds = Array.from(
    new Set(allRoles.filter(r => allRoleIds.has(r.id)).map(r => r.personId))
  );
  return {
    roleIds: Array.from(allRoleIds),
    personIds,
    directPersonIds,
  };
}

/**
 * Resolve the full viewer scope for a person.
 * Heavy lift: pulls all roles + org units once and walks them in memory.
 * Cache at request scope if you need to call multiple times.
 */
export async function resolveViewerScope(
  person: Person,
  tenantId: number
): Promise<ViewerScope> {
  const db = await getDb();
  if (!db) {
    // Degenerate fallback — minimal scope
    return {
      person,
      primaryRole: null,
      allRoles: [],
      tier: "MEMBER",
      defaultLanding: "me",
      ownedOrgUnitIds: [],
      subordinatePersonIds: [],
      directReportPersonIds: [],
      isFundWide: false,
    };
  }

  const [personRoles, allRoles, allUnits] = await Promise.all([
    db
      .select()
      .from(roles)
      .where(and(eq(roles.personId, person.id), eq(roles.tenantId, tenantId), eq(roles.isActive, true))),
    db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.isActive, true))),
    db.select().from(orgUnits).where(eq(orgUnits.tenantId, tenantId)),
  ]);

  // Pick primary role: preferred order (CHAIRMAN > GROUP_CEO > CEO > CXO > others)
  const order = ["CHAIRMAN", "GROUP_CEO", "GROUP_CHRO", "CEO", "CXO", "CHRO", "BOARD_MEMBER", "CXO_PLUS_ONE"];
  const sortedRoles = [...personRoles].sort(
    (a, b) => order.indexOf(a.roleType) - order.indexOf(b.roleType)
  );
  const primaryRole = sortedRoles[0] ?? null;
  const tier = roleTypeToTier(primaryRole?.roleType);

  // Org units this viewer leads (directly attached via roles.orgUnitId, plus those where they're listed as leaderPersonId)
  const directOwnedRoots = new Set<number>();
  for (const r of personRoles) {
    if (r.orgUnitId) directOwnedRoots.add(r.orgUnitId);
  }
  for (const u of allUnits) {
    if (u.leaderPersonId === person.id) directOwnedRoots.add(u.id);
  }
  // CHAIRMAN / GROUP_CEO see everything
  let ownedOrgUnitIds: number[];
  let isFundWide = false;
  if (tier === "CHAIRMAN" || tier === "GROUP_CEO") {
    ownedOrgUnitIds = allUnits.map(u => u.id);
    isFundWide = true;
  } else {
    ownedOrgUnitIds = await descendantOrgUnitIds(Array.from(directOwnedRoots), allUnits);
  }

  // Subordinate person IDs via reportsToRoleId graph
  const myRoleIds = personRoles.map(r => r.id);
  let subordinatePersonIds: number[] = [];
  let directReportPersonIds: number[] = [];
  if (tier === "CHAIRMAN" || tier === "GROUP_CEO") {
    // Everyone in tenant
    const allPersonsInTenant = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.tenantId, tenantId));
    subordinatePersonIds = allPersonsInTenant.map(p => p.id).filter(id => id !== person.id);
    const direct = transitiveReports(myRoleIds, allRoles);
    directReportPersonIds = direct.directPersonIds;
  } else {
    const t = transitiveReports(myRoleIds, allRoles);
    subordinatePersonIds = t.personIds;
    directReportPersonIds = t.directPersonIds;
  }

  const defaultLanding = landingForTier(tier, directReportPersonIds.length > 0);

  return {
    person,
    primaryRole,
    allRoles: personRoles,
    tier,
    defaultLanding,
    ownedOrgUnitIds,
    subordinatePersonIds,
    directReportPersonIds,
    isFundWide,
  };
}

/**
 * Visibility check: can `viewer` see data about `subjectPersonId`?
 * Rules:
 *   - Always YES if subject is the viewer themselves
 *   - YES if subject is in viewer's subordinate tree
 *   - YES if viewer is fund-wide
 *   - Otherwise NO (peer/upward visibility requires explicit access grant)
 */
export function canViewPerson(viewer: ViewerScope, subjectPersonId: number): boolean {
  if (viewer.person.id === subjectPersonId) return true;
  if (viewer.isFundWide) return true;
  return viewer.subordinatePersonIds.includes(subjectPersonId);
}

export function canViewOrgUnit(viewer: ViewerScope, orgUnitId: number): boolean {
  if (viewer.isFundWide) return true;
  return viewer.ownedOrgUnitIds.includes(orgUnitId);
}

/**
 * Map viewer scope → org-scope label used by aiInsights.scope and agenticMemories.orgScope.
 */
export function viewerToOrgScope(viewer: ViewerScope): "FUND" | "COMPANY" | "FUNCTION" | "TEAM" | "INDIVIDUAL" {
  if (viewer.isFundWide) return "FUND";
  if (viewer.tier === "CEO") return "COMPANY";
  if (viewer.tier === "CXO") return "FUNCTION";
  if (viewer.directReportPersonIds.length > 0) return "TEAM";
  return "INDIVIDUAL";
}
