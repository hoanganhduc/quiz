import { describe, expect, it } from "vitest";
import type { SessionV2 } from "@app/shared";
import { issueSessionCookie, readSession, signSession, verifySession } from "../src/session";

const env = { JWT_SECRET: "test-secret" } as any;

const sessionPayload: SessionV2 = {
  appUserId: "550e8400-e29b-41d4-a716-446655440000",
  roles: ["admin"],
  providers: ["github"],
  displayName: "Test User"
};

describe("session sign/verify", () => {
  it("signs and verifies a SessionV2", async () => {
    const token = await signSession(env, sessionPayload);
    const verified = await verifySession(env, token);
    expect(verified).toMatchObject({
      appUserId: sessionPayload.appUserId,
      roles: ["admin"],
      providers: ["github"],
      displayName: "Test User"
    });
  });

  it("returns null for invalid token", async () => {
    const verified = await verifySession(env, "invalid.token");
    expect(verified).toBeNull();
  });

  it("reads session from cookie", async () => {
    const cookie = await issueSessionCookie(env, new Request("http://worker"), sessionPayload);
    const req = new Request("http://worker", { headers: { Cookie: cookie } });
    const session = await readSession(env, req);
    expect(session?.appUserId).toBe(sessionPayload.appUserId);
  });
});
