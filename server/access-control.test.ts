import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db", () => ({
  getAccessGrantsByTenant: vi.fn().mockResolvedValue([]),
  getAccessGrantsByUser: vi.fn().mockResolvedValue([]),
  getAccessGrantById: vi.fn().mockResolvedValue(null),
  createAccessGrant: vi.fn().mockResolvedValue({ id: 1 }),
  revokeAccessGrant: vi.fn().mockResolvedValue(undefined),
  getAccessChallengesByUser: vi.fn().mockResolvedValue([]),
  getAccessChallengesByTenant: vi.fn().mockResolvedValue([]),
  createAccessChallenge: vi.fn().mockResolvedValue({ id: 1 }),
  resolveAccessChallenge: vi.fn().mockResolvedValue(undefined),
  getUserPreferences: vi.fn().mockResolvedValue(null),
  upsertUserPreferences: vi.fn().mockResolvedValue(undefined),
  markOnboardingComplete: vi.fn().mockResolvedValue(undefined),
}));

import * as db from "./db";

describe("Access Control DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createAccessGrant is called with correct shape", async () => {
    const input = {
      tenantId: 1,
      grantedByUserId: 42,
      grantedToEmail: "test@example.com",
      targetOrgUnitId: 5,
      accessLevel: "VIEW_ONLY" as const,
      justification: "Testing",
      expiresAt: new Date("2027-01-01"),
      status: "ACTIVE" as const,
    };
    await db.createAccessGrant(input);
    expect(db.createAccessGrant).toHaveBeenCalledWith(input);
  });

  it("getAccessGrantsByUser returns empty array by default", async () => {
    const result = await db.getAccessGrantsByUser(1, 1);
    expect(result).toEqual([]);
  });

  it("revokeAccessGrant is called with grantId, tenantId, and revokedByUserId", async () => {
    await db.revokeAccessGrant(10, 1, 42);
    expect(db.revokeAccessGrant).toHaveBeenCalledWith(10, 1, 42);
  });

  it("createAccessChallenge is called with correct shape", async () => {
    const input = {
      tenantId: 1,
      submittedByUserId: 42,
      challengeType: "UNAUTHORIZED_ACCESS" as const,
      description: "Someone accessed my data without permission",
      relatedGrantId: null,
      status: "PENDING" as const,
    };
    await db.createAccessChallenge(input);
    expect(db.createAccessChallenge).toHaveBeenCalledWith(input);
  });

  it("getAccessChallengesByUser returns empty array by default", async () => {
    const result = await db.getAccessChallengesByUser(1);
    expect(result).toEqual([]);
  });
});

describe("User Preferences DB helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUserPreferences returns null for new user", async () => {
    const result = await db.getUserPreferences(99);
    expect(result).toBeNull();
  });

  it("upsertUserPreferences is called with userId and prefs", async () => {
    const prefs = {
      notifyPriorityZero: true,
      notifyInsights: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "08:00",
      maxNotificationsPerDay: 5,
    };
    await db.upsertUserPreferences(42, prefs);
    expect(db.upsertUserPreferences).toHaveBeenCalledWith(42, prefs);
  });

  it("markOnboardingComplete is called with userId", async () => {
    await db.markOnboardingComplete(42);
    expect(db.markOnboardingComplete).toHaveBeenCalledWith(42);
  });
});
