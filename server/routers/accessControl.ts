import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

export const accessControlRouter = router({
  // ─── Access Grants ───────────────────────────────────────────────────────

  listGrants: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input, ctx }) => {
      const grants = await db.getAccessGrantsByTenant(input.tenantId);
      return grants;
    }),

  myGrants: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input, ctx }) => {
      return await db.getAccessGrantsByUser(ctx.user.id, input.tenantId);
    }),

  createGrant: protectedProcedure
    .input(
      z.object({
        tenantId: z.number(),
        grantedToEmail: z.string().email(),
        targetOrgUnitId: z.number(),
        accessLevel: z.enum(["VIEW_ONLY", "VIEW_AND_COMMENT", "FULL_ACCESS"]),
        justification: z.string().optional(),
        expiresAt: z.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.createAccessGrant({
        tenantId: input.tenantId,
        grantedByUserId: ctx.user.id,
        grantedToEmail: input.grantedToEmail,
        targetOrgUnitId: input.targetOrgUnitId,
        accessLevel: input.accessLevel,
        justification: input.justification ?? null,
        expiresAt: input.expiresAt,
        status: "ACTIVE",
      });
      return { success: true };
    }),

  revokeGrant: protectedProcedure
    .input(z.object({ grantId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const grant = await db.getAccessGrantById(input.grantId);
      if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "Grant not found" });
      if (grant.grantedByUserId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You can only revoke your own grants" });
      }
      await db.revokeAccessGrant(input.grantId, ctx.user.id);
      return { success: true };
    }),

  // ─── Access Challenges ────────────────────────────────────────────────────

  listMyChallenges: protectedProcedure
    .query(async ({ ctx }) => {
      return await db.getAccessChallengesByUser(ctx.user.id);
    }),

  listTenantChallenges: protectedProcedure
    .input(z.object({ tenantId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      return await db.getAccessChallengesByTenant(input.tenantId);
    }),

  submitChallenge: protectedProcedure
    .input(
      z.object({
        tenantId: z.number(),
        challengeType: z.enum([
          "UNAUTHORIZED_ACCESS",
          "INCORRECT_VISIBILITY",
          "MISSING_ACCESS",
          "DATA_ACCURACY",
          "PRIVACY_CONCERN",
          "OTHER",
        ]),
        description: z.string().min(10, "Please provide at least 10 characters"),
        relatedGrantId: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.createAccessChallenge({
        tenantId: input.tenantId,
        submittedByUserId: ctx.user.id,
        challengeType: input.challengeType,
        description: input.description,
        relatedGrantId: input.relatedGrantId ?? null,
        status: "PENDING",
      });
      return { success: true };
    }),

  resolveChallenge: protectedProcedure
    .input(
      z.object({
        challengeId: z.number(),
        resolution: z.string().min(5),
        status: z.enum(["RESOLVED", "DISMISSED"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      await db.resolveAccessChallenge(
        input.challengeId,
        ctx.user.id,
        input.resolution,
        input.status
      );
      return { success: true };
    }),

  // ─── Admin: All Challenges Across All Tenants ─────────────────────────────

  adminListAllChallenges: protectedProcedure
    .input(
      z.object({
        statusFilter: z.enum(["ALL", "PENDING", "RESOLVED", "DISMISSED"]).default("PENDING"),
      })
    )
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
      }
      return await db.adminGetAllChallenges(input.statusFilter === "ALL" ? undefined : input.statusFilter);
    }),
});
