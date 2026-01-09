import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import { createUserWithProvider, getAppUserIdByProvider, getUser } from "../src/users/store";
import { issueSessionCookie } from "../src/session";
import type { SessionV2 } from "@app/shared";

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

function mockGithubFetch(userId: number, login = "octo", name = "Octo", email = "octo@example.com") {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("github.com/login/oauth/access_token")) {
      return new Response(JSON.stringify({ access_token: "token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.includes("api.github.com/user/emails")) {
      return new Response(JSON.stringify([{ email, primary: true }]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url.includes("api.github.com/user")) {
      return new Response(JSON.stringify({ id: userId, name, login }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response("not found", { status: 404 });
  });
}

function getStateFromLocation(location: string | null) {
  if (!location) return null;
  const url = new URL(location);
  return url.searchParams.get("state");
}

describe("github oauth", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    vi.restoreAllMocks();
  });

  it("login creates and loads user", async () => {
    const startRes = await app.fetch(
      new Request("http://worker/auth/github/start?redirect=http://ui.example/#/home"),
      env
    );
    expect(startRes.status).toBe(302);
    const state = getStateFromLocation(startRes.headers.get("Location"));
    expect(state).toBeTruthy();

    const fetchMock = mockGithubFetch(111, "octo", "Octo", "octo@example.com");
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.fetch(
      new Request(`http://worker/auth/callback/github?code=abc&state=${state}`),
      env
    );
    expect(res.status).toBe(302);

    const appUserId = await getAppUserIdByProvider(env as any, "github", "111");
    expect(appUserId).toBeTruthy();
    const user = await getUser(env as any, appUserId!);
    expect(user?.linked.github?.username).toBe("octo");

    const startRes2 = await app.fetch(
      new Request("http://worker/auth/github/start?redirect=http://ui.example/#/home"),
      env
    );
    expect(startRes2.status).toBe(302);
    const state2 = getStateFromLocation(startRes2.headers.get("Location"));
    expect(state2).toBeTruthy();

    const res2 = await app.fetch(
      new Request(`http://worker/auth/callback/github?code=abc&state=${state2}`),
      env
    );
    expect(res2.status).toBe(302);
    const appUserId2 = await getAppUserIdByProvider(env as any, "github", "111");
    expect(appUserId2).toBe(appUserId);
  });

  it("link mode links github to existing user", async () => {
    const user = await createUserWithProvider(
      env as any,
      "google",
      "g-123",
      { sub: "g-123" },
      { displayName: "Google User" }
    );

    const session: SessionV2 = {
      appUserId: user.appUserId,
      roles: [],
      providers: ["google"],
      displayName: user.profile.displayName
    };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const startRes = await app.fetch(
      new Request("http://worker/auth/github/start?redirect=http://ui.example/#/home&mode=link", {
        headers: { Cookie: cookie }
      }),
      env
    );
    expect(startRes.status).toBe(302);
    const state = getStateFromLocation(startRes.headers.get("Location"));
    expect(state).toBeTruthy();

    const fetchMock = mockGithubFetch(222, "linkocto", "Link Octo", "link@example.com");
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.fetch(
      new Request(`http://worker/auth/callback/github?code=abc&state=${state}`),
      env
    );
    expect(res.status).toBe(302);

    const appUserId = await getAppUserIdByProvider(env as any, "github", "222");
    expect(appUserId).toBe(user.appUserId);
    const updated = await getUser(env as any, user.appUserId);
    expect(updated?.linked.github?.username).toBe("linkocto");
  });

  it("link conflict returns 409", async () => {
    const userA = await createUserWithProvider(
      env as any,
      "github",
      "333",
      { userId: "333", username: "octo" },
      {}
    );
    const userB = await createUserWithProvider(
      env as any,
      "google",
      "g-789",
      { sub: "g-789" },
      {}
    );

    const session: SessionV2 = {
      appUserId: userB.appUserId,
      roles: [],
      providers: ["google"],
      displayName: "Google"
    };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const startRes = await app.fetch(
      new Request("http://worker/auth/github/start?redirect=http://ui.example/#/home&mode=link", {
        headers: { Cookie: cookie }
      }),
      env
    );
    expect(startRes.status).toBe(302);
    const state = getStateFromLocation(startRes.headers.get("Location"));
    expect(state).toBeTruthy();

    const fetchMock = mockGithubFetch(333, "octo", "Octo", "octo@example.com");
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.fetch(
      new Request(`http://worker/auth/callback/github?code=abc&state=${state}`),
      env
    );
    expect(res.status).toBe(409);

    const mapping = await getAppUserIdByProvider(env as any, "github", "333");
    expect(mapping).toBe(userA.appUserId);
  });
});
