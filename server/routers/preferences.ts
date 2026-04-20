import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const preferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await db.getUserPreferences(ctx.user.id);
    // Return defaults if no preferences exist yet
    return (
      prefs ?? {
        notifyPriorityZero: true,
        notifyInsights: true,
        notifyReminders: true,
        notifyMilestones: true,
        notifyPulseCheck: true,
        notifyAchievementSuggestions: true,
        notifyBrowserPush: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "08:00",
        maxNotificationsPerDay: 3,
        onboardingCompleted: false,
        onboardingCompletedAt: null,
      }
    );
  }),

  save: protectedProcedure
    .input(
      z.object({
        notifyPriorityZero: z.boolean().optional(),
        notifyInsights: z.boolean().optional(),
        notifyReminders: z.boolean().optional(),
        notifyMilestones: z.boolean().optional(),
        notifyPulseCheck: z.boolean().optional(),
        notifyAchievementSuggestions: z.boolean().optional(),
        notifyBrowserPush: z.boolean().optional(),
        quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        maxNotificationsPerDay: z.number().int().min(1).max(50).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.upsertUserPreferences(ctx.user.id, input);
      return { success: true };
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markOnboardingComplete(ctx.user.id);
    return { success: true };
  }),

  checkOnboarding: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await db.getUserPreferences(ctx.user.id);
    return { completed: prefs?.onboardingCompleted ?? false };
  }),

  resetOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await db.upsertUserPreferences(ctx.user.id, {
      onboardingCompleted: false,
      onboardingCompletedAt: null,
    });
    return { success: true };
  }),
});
