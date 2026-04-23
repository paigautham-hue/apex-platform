/**
 * 360-engine.ts — Fractal 360 cycle generation.
 *
 * Any leader (Chairman, Group CEO, CEO, CXO) can spin up a 360 cycle on
 * their team. The engine generates assignmentAssignments rows so each
 * person is rated by:
 *   - themselves (self)
 *   - their leader (e.g., chairman for CXOs, CEO for their direct reports)
 *   - their peers (other people reporting to the same leader)
 *   - optionally their downward reports (upward feedback)
 */

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  roles,
  feedbackTypes,
  assessmentAssignments,
  governanceCycles,
} from "../drizzle/schema";

interface Generate360Input {
  tenantId: number;
  cycleId: number;
  /** Leader whose team is being 360'd */
  leaderRoleId: number;
  /** Whether to include peer-to-peer assignments */
  includePeer: boolean;
  /** Whether to include upward (subordinate → leader) assignments */
  includeUpward: boolean;
  /** Whether to include leader → subordinate */
  includeDownward: boolean;
  /** Days from now to set deadline */
  deadlineDays: number;
}

export async function generate360Assignments(input: Generate360Input): Promise<{ created: number }> {
  const db = await getDb();
  if (!db) return { created: 0 };

  // Find feedback types
  const ftAll = await db
    .select()
    .from(feedbackTypes)
    .where(and(eq(feedbackTypes.tenantId, input.tenantId), eq(feedbackTypes.isActive, true)));
  const selfType = ftAll.find(f => f.key === "self");
  const peerType = ftAll.find(f => f.key === "peer");
  const upwardType = ftAll.find(f => f.key === "upward");
  const downwardType = ftAll.find(f => f.key === "chairman" || f.key === "leader" || f.key === "downward");

  // Find roles reporting to leader
  const subordinates = await db
    .select()
    .from(roles)
    .where(and(eq(roles.tenantId, input.tenantId), eq(roles.reportsToRoleId, input.leaderRoleId), eq(roles.isActive, true)));

  if (subordinates.length === 0) return { created: 0 };

  const dueDate = new Date(Date.now() + input.deadlineDays * 24 * 60 * 60 * 1000);
  const createdAssignments: any[] = [];

  // 1. Self assignments
  if (selfType) {
    for (const sub of subordinates) {
      createdAssignments.push({
        tenantId: input.tenantId,
        cycleId: input.cycleId,
        assessorPersonId: sub.personId,
        targetType: "ROLE" as const,
        targetId: sub.id,
        feedbackTypeId: selfType.id,
        status: "PENDING" as const,
        dueDate,
      });
    }
  }

  // 2. Downward (leader → subordinate)
  if (input.includeDownward && downwardType) {
    const leaderRows = await db
      .select()
      .from(roles)
      .where(eq(roles.id, input.leaderRoleId))
      .limit(1);
    if (leaderRows.length > 0) {
      const leaderPersonId = leaderRows[0].personId;
      for (const sub of subordinates) {
        createdAssignments.push({
          tenantId: input.tenantId,
          cycleId: input.cycleId,
          assessorPersonId: leaderPersonId,
          targetType: "ROLE" as const,
          targetId: sub.id,
          feedbackTypeId: downwardType.id,
          status: "PENDING" as const,
          dueDate,
        });
      }
    }
  }

  // 3. Peer (each subordinate rates 3 random peers)
  if (input.includePeer && peerType && subordinates.length > 1) {
    for (const sub of subordinates) {
      const peers = subordinates.filter(s => s.id !== sub.id);
      // Pick up to 3 peers
      const sampled = peers.sort(() => Math.random() - 0.5).slice(0, 3);
      for (const peer of sampled) {
        createdAssignments.push({
          tenantId: input.tenantId,
          cycleId: input.cycleId,
          assessorPersonId: sub.personId,
          targetType: "ROLE" as const,
          targetId: peer.id,
          feedbackTypeId: peerType.id,
          status: "PENDING" as const,
          dueDate,
        });
      }
    }
  }

  // 4. Upward (subordinates → leader)
  if (input.includeUpward && upwardType) {
    for (const sub of subordinates) {
      createdAssignments.push({
        tenantId: input.tenantId,
        cycleId: input.cycleId,
        assessorPersonId: sub.personId,
        targetType: "ROLE" as const,
        targetId: input.leaderRoleId,
        feedbackTypeId: upwardType.id,
        status: "PENDING" as const,
        dueDate,
      });
    }
  }

  if (createdAssignments.length === 0) return { created: 0 };

  // Dedup against existing assignments for this cycle (idempotent re-runs)
  const existing = await db
    .select()
    .from(assessmentAssignments)
    .where(
      and(
        eq(assessmentAssignments.tenantId, input.tenantId),
        eq(assessmentAssignments.cycleId, input.cycleId)
      )
    );
  const key = (a: { assessorPersonId: number; targetType: string; targetId: number; feedbackTypeId: number }) =>
    `${a.assessorPersonId}:${a.targetType}:${a.targetId}:${a.feedbackTypeId}`;
  const seen = new Set(existing.map(key));
  const fresh = createdAssignments.filter(a => !seen.has(key(a)));
  if (fresh.length === 0) return { created: 0 };

  await db.insert(assessmentAssignments).values(fresh);
  return { created: fresh.length };
}
