import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";
import app from "../src/index";
import { createUserWithProvider, getAppUserIdByProvider, getUser } from "../src/users/store";
import { issueSessionCookie } from "../src/session";
import type { SessionV2 } from "@app/shared";

const jwksHolder = vi.hoisted(() => {
  let jwks: ReturnType<typeof createLocalJWKSet> | null = null;
  return {
    set: (value: ReturnType<typeof createLocalJWKSet>) => {
      jwks = value;
    },
    get: () => jwks
  };
});

vi.mock("../src/auth/jwksCache", () => ({
  getGoogleJwks: () => {
    const jwks = jwksHolder.get();
    if (!jwks) throw new Error("JWKS not initialized");
    return jwks;
  }
}));

class MemoryKV implements KVNamespace {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

type TestEnv = {
  QUIZ_KV: KVNamespace;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
  CODE_PEPPER: string;
  UI_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

const baseEnv: TestEnv = {
  QUIZ_KV: new MemoryKV(),
  ADMIN_TOKEN: "adm",
  JWT_SECRET: "secret",
  CODE_PEPPER: "pep",
  UI_ORIGIN: "http://ui.example",
  GITHUB_CLIENT_ID: "gid",
  GITHUB_CLIENT_SECRET: "gsec",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret"
};

let privateKey: CryptoKey;
let kid: string;

async function signIdToken(sub: string, email: string, name = "Google User") {
  return new SignJWT({
    iss: "https://accounts.google.com",
    aud: baseEnv.GOOGLE_CLIENT_ID,
    sub,
    email,
    name
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(privateKey);
}

describe("google oauth", () => {
  let env: TestEnv;

  beforeAll(async () => {
    const { publicKey, privateKey: priv } = await generateKeyPair("RS256");
    privateKey = priv;
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test-key";
    jwk.use = "sig";
    jwk.alg = "RS256";
    kid = jwk.kid;
    jwksHolder.set(createLocalJWKSet({ keys: [jwk] }));
  });

  beforeEach(() => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
  });

  it("login creates and loads user", async () => {
    const idToken = await signIdToken("sub-1", "user1@example.com", "User One");
    const res = await app.fetch(
      new Request("http://worker/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }),
      env
    );
    expect(res.status).toBe(200);

    const appUserId = await getAppUserIdByProvider(env as any, "google", "sub-1");
    expect(appUserId).toBeTruthy();
    const user = await getUser(env as any, appUserId!);
    expect(user?.linked.google?.email).toBe("user1@example.com");

    const idToken2 = await signIdToken("sub-1", "user1@example.com", "User One");
    const res2 = await app.fetch(
      new Request("http://worker/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: idToken2 })
      }),
      env
    );
    expect(res2.status).toBe(200);
    const appUserId2 = await getAppUserIdByProvider(env as any, "google", "sub-1");
    expect(appUserId2).toBe(appUserId);
  });

  it("link mode links google to existing user", async () => {
    const user = await createUserWithProvider(
      env as any,
      "github",
      "gh-1",
      { userId: "gh-1" },
      { displayName: "GitHub User" }
    );

    const session: SessionV2 = {
      appUserId: user.appUserId,
      roles: [],
      providers: ["github"],
      displayName: user.profile.displayName
    };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const idToken = await signIdToken("sub-link", "link@example.com", "Link User");
    const res = await app.fetch(
      new Request("http://worker/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ idToken, mode: "link" })
      }),
      env
    );
    expect(res.status).toBe(200);

    const appUserId = await getAppUserIdByProvider(env as any, "google", "sub-link");
    expect(appUserId).toBe(user.appUserId);
    const updated = await getUser(env as any, user.appUserId);
    expect(updated?.linked.google?.email).toBe("link@example.com");
  });

  it("link conflict returns 409", async () => {
    const userA = await createUserWithProvider(
      env as any,
      "google",
      "sub-conflict",
      { sub: "sub-conflict" },
      {}
    );
    const userB = await createUserWithProvider(
      env as any,
      "github",
      "gh-2",
      { userId: "gh-2" },
      {}
    );

    const session: SessionV2 = {
      appUserId: userB.appUserId,
      roles: [],
      providers: ["github"],
      displayName: "GitHub"
    };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const idToken = await signIdToken("sub-conflict", "conflict@example.com", "Conflict User");
    const res = await app.fetch(
      new Request("http://worker/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ idToken, mode: "link" })
      }),
      env
    );
    expect(res.status).toBe(409);

    const mapping = await getAppUserIdByProvider(env as any, "google", "sub-conflict");
    expect(mapping).toBe(userA.appUserId);
  });
});
