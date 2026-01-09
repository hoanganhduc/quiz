import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { putUser } from "../src/users/store";
import { issueSessionCookie } from "../src/session";
import type { AppUser, SessionV2 } from "@app/shared";

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

  async list(options?: { prefix?: string }): Promise<KVNamespaceListResult> {
    const prefix = options?.prefix ?? "";
    const keys = Array.from(this.store.keys())
      .filter((key) => key.startsWith(prefix))
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor: "" };
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

async function makeAdminSession(env: TestEnv, appUserId: string) {
  const session: SessionV2 = {
    appUserId,
    roles: ["admin"],
    providers: ["github"],
    displayName: "Admin"
  };
  return issueSessionCookie(env as any, new Request("http://worker"), session);
}

describe("admin user management", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
  });

  it("requires admin for search", async () => {
    const res = await app.fetch(new Request("http://worker/admin/users/search?q=test"), env);
    expect(res.status).toBe(401);
  });

  it("searches by github username and google email", async () => {
    const user: AppUser = {
      appUserId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roles: ["admin"],
      profile: { displayName: "Admin" },
      linked: {
        github: { userId: "1", username: "OctoCat" },
        google: { sub: "g1", email: "octo@example.com" }
      }
    };
    await putUser(env as any, user);

    const cookie = await makeAdminSession(env, user.appUserId);
    const res = await app.fetch(
      new Request("http://worker/admin/users/search?q=octo", { headers: { Cookie: cookie } }),
      env
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { users: any[] };
    expect(json.users.length).toBe(1);
    expect(json.users[0].appUserId).toBe(user.appUserId);
  });

  it("updates roles", async () => {
    const target: AppUser = {
      appUserId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roles: [],
      profile: { displayName: "User" },
      linked: {}
    };
    await putUser(env as any, target);

    const adminUserId = crypto.randomUUID();
    const admin: AppUser = {
      appUserId: adminUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roles: ["admin"],
      profile: { displayName: "Admin" },
      linked: {}
    };
    await putUser(env as any, admin);

    const cookie = await makeAdminSession(env, adminUserId);
    const res = await app.fetch(
      new Request(`http://worker/admin/users/${target.appUserId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ makeAdmin: true })
      }),
      env
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { user: { roles: string[] } };
    expect(json.user.roles).toContain("admin");

    const resRemove = await app.fetch(
      new Request(`http://worker/admin/users/${target.appUserId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ makeAdmin: false })
      }),
      env
    );
    expect(resRemove.status).toBe(200);
    const jsonRemove = (await resRemove.json()) as { user: { roles: string[] } };
    expect(jsonRemove.user.roles).not.toContain("admin");
  });
});
