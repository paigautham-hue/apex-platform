/**
 * Governance notification triggers (Phase 2.3).
 *
 * Governance events fan out to notifications on the existing budgeted
 * channel (max 3/day per person is enforced on read). We reuse the
 * existing notifications.type enum rather than extend it:
 *
 *   REMINDER  -> cycle open, deadline nudges, missing journal entries
 *   INSIGHT   -> chairman submitted, reveal
 *
 * Each trigger resolves the target person set inline — these are fire-
 * and-forget from the caller's perspective; errors are logged but do not
 * block the mutation that triggered them.
 */

import * as db from "./db";

async function safeCreateMany(
  personIds: number[],
  tenantId: number,
  template: { type: "REMINDER" | "INSIGHT"; title: string; body: string; actionUrl?: string | null },
) {
  for (const personId of personIds) {
    try {
      await db.createNotification({
        tenantId,
        personId,
        type: template.type,
        title: template.title,
        body: template.body,
        actionUrl: template.actionUrl ?? null,
      });
    } catch (err) {
      console.warn(`[governance-notifications] failed to create for person ${personId}:`, err);
    }
  }
}

export async function notifyCycleOpen(tenantId: number, month: string) {
  const persons = await db.getPersonsByTenant(tenantId);
  await safeCreateMany(
    persons.map((p) => p.id),
    tenantId,
    {
      type: "REMINDER",
      title: `Governance cycle ${month} is open`,
      body: `Log this month's progress, plan the next heading, and submit your self-rating before the deadline.`,
      actionUrl: "/my-bridge",
    },
  );
}

export async function notifyCycleReveal(tenantId: number, month: string) {
  const persons = await db.getPersonsByTenant(tenantId);
  await safeCreateMany(
    persons.map((p) => p.id),
    tenantId,
    {
      type: "INSIGHT",
      title: `Perception gaps revealed for ${month}`,
      body: `Chairman assessments are now visible alongside your self-rating. Review gaps and read the guidance on each mandate.`,
      actionUrl: "/my-bridge",
    },
  );
}

export async function notifyChairmanSubmittedForRoleTarget(
  tenantId: number,
  roleId: number,
  month: string,
) {
  const role = await db.getRoleById(roleId);
  if (!role) return;
  // Target person = the person who holds the role; they get the notification
  const person = await db.getPersonById(role.personId);
  if (!person) return;
  await safeCreateMany([person.id], tenantId, {
    type: "INSIGHT",
    title: `Chairman has rated you for ${month}`,
    body: `Once you also submit for this cycle, your perception gap panel will unlock on your Bridge.`,
    actionUrl: "/my-bridge",
  });
}

export async function notifyChairmanSubmittedForCompanyTarget(
  tenantId: number,
  orgUnitId: number,
  month: string,
) {
  const companies = await db.getOrgUnitsByTenant(tenantId);
  const company = companies.find((c) => c.id === orgUnitId);
  if (!company || !company.leaderPersonId) return;
  await safeCreateMany([company.leaderPersonId], tenantId, {
    type: "INSIGHT",
    title: `Chairman has rated ${company.name} for ${month}`,
    body: `Submit your Island for this cycle to unlock the perception gap panel.`,
    actionUrl: "/my-island",
  });
}

/**
 * Weekly nudge for people who have not yet filed any journal entries this
 * cycle. Intended to be called on a schedule (e.g. cron once a week while
 * a cycle is OPEN). Exposed here so the scheduler can import and call it.
 */
export async function nudgeMissingJournals(tenantId: number, cycleId: number, month: string) {
  const persons = await db.getPersonsByTenant(tenantId);
  for (const person of persons) {
    const journals = await db.getMandateJournalsByPersonAndCycle(person.id, cycleId, tenantId);
    if (journals.length > 0) continue;
    await safeCreateMany([person.id], tenantId, {
      type: "REMINDER",
      title: `Your Bridge is dark for ${month}`,
      body: `No journal entries logged yet this cycle. A few lines per mandate keeps the record alive.`,
      actionUrl: "/my-bridge",
    });
  }
}

/**
 * Deadline reminder nudge, intended to fire at T-7, T-3, T-1 days before
 * the cycle deadline. Scheduler decides when; this just sends the note.
 */
export async function notifyDeadlineIn(tenantId: number, month: string, daysLeft: number) {
  const persons = await db.getPersonsByTenant(tenantId);
  await safeCreateMany(
    persons.map((p) => p.id),
    tenantId,
    {
      type: "REMINDER",
      title: `${daysLeft} day${daysLeft === 1 ? "" : "s"} until ${month} deadline`,
      body: `Submit your Bridge / Island entries before the cycle closes.`,
      actionUrl: "/my-bridge",
    },
  );
}
