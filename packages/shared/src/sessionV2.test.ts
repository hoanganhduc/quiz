import { describe, expect, it } from "vitest";
import { AppUserSchema, SessionV2Schema, SubmissionSummaryV1Schema } from "./index.js";

describe("AppUserSchema", () => {
  it("parses valid AppUser", () => {
    const parsed = AppUserSchema.parse({
      appUserId: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: "2024-01-02T03:04:05.000Z",
      updatedAt: "2024-01-03T03:04:05.000Z",
      roles: ["admin"],
      profile: { displayName: "Admin", email: "admin@example.com" },
      linked: {
        github: { userId: "123", username: "octo" },
        google: { sub: "abc", email: "g@example.com" }
      }
    });

    expect(parsed.appUserId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(parsed.roles).toContain("admin");
  });

  it("rejects missing appUserId", () => {
    expect(() =>
      AppUserSchema.parse({
        createdAt: "2024-01-02T03:04:05.000Z",
        updatedAt: "2024-01-03T03:04:05.000Z",
        roles: [],
        profile: {},
        linked: {}
      })
    ).toThrow();
  });
});

describe("SessionV2Schema", () => {
  it("parses valid session", () => {
    const parsed = SessionV2Schema.parse({
      appUserId: "550e8400-e29b-41d4-a716-446655440001",
      roles: ["admin"],
      providers: ["github", "anon"],
      displayName: "Test"
    });

    expect(parsed.providers).toContain("github");
  });
});

describe("SubmissionSummaryV1Schema", () => {
  it("parses summary with version", () => {
    const parsed = SubmissionSummaryV1Schema.parse({
      submissionId: "sub-1",
      examId: "exam-1",
      submittedAt: "2024-02-01T10:00:00.000Z",
      score: { correct: 8, total: 10 },
      version: { versionId: "v1", versionIndex: 2 }
    });

    expect(parsed.version?.versionId).toBe("v1");
  });
});
