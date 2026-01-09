import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index";
import type { Env } from "../src/env";
import { putUser } from "../src/users/store";
import { issueSessionCookie } from "../src/session";
import type { AppUser, SessionV2, SourcesConfigV1 } from "@app/shared";
import { putSourcesConfig } from "../src/sources/store";
import { putSecret } from "../src/secrets/store";

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

  async list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }> {
    const keys = Array.from(this.store.keys())
      .filter((k) => (options?.prefix ? k.startsWith(options.prefix) : true))
      .map((name) => ({ name }));
    return { keys };
  }
}

type TestEnv = Env;

const baseEnv: TestEnv = {
  QUIZ_KV: new MemoryKV(),
  ADMIN_TOKEN: "adm",
  JWT_SECRET: "secret",
  CODE_PEPPER: "pep",
  UI_ORIGIN: "http://ui.example",
  GITHUB_CLIENT_ID: "gid",
  GITHUB_CLIENT_SECRET: "gsec",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  CONFIG_ENC_KEY_B64: Buffer.from(new Uint8Array(32)).toString("base64")
};

describe("admin sources endpoints", () => {
  let env: TestEnv;

  beforeEach(() => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    vi.restoreAllMocks();
  });

  it("denies non-admin user", async () => {
    const appUserId = crypto.randomUUID();
    const user: AppUser = {
      appUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roles: [],
      profile: {},
      linked: {}
    };
    await putUser(env as any, user);
    const session: SessionV2 = { appUserId, roles: [], providers: ["anon"], displayName: "user" };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const res = await app.fetch(new Request("http://worker/admin/sources", { headers: { Cookie: cookie } }), env);
    expect(res.status).toBe(403);
  });

  it("allows admin user", async () => {
    const appUserId = crypto.randomUUID();
    const user: AppUser = {
      appUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      roles: ["admin"],
      profile: {},
      linked: {}
    };
    await putUser(env as any, user);
    const session: SessionV2 = { appUserId, roles: ["admin"], providers: ["anon"], displayName: "admin" };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const res = await app.fetch(new Request("http://worker/admin/sources", { headers: { Cookie: cookie } }), env);
    expect(res.status).toBe(200);
  });

  it("allows bearer admin token", async () => {
    const res = await app.fetch(
      new Request("http://worker/admin/sources", {
        headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}` }
      }),
      env
    );
    expect(res.status).toBe(200);
  });

  it("exports resolved sources config", async () => {
    await putSecret(env, "gh-token", "TOKEN123");
    await putSecret(env, "gd-auth", "Authorization: Bearer <TOKEN>");

    const cfg: SourcesConfigV1 = {
      version: "v1",
      courseCode: "c1",
      subject: "math",
      uidNamespace: "ns",
      sources: [
        {
          id: "gh1",
          type: "github",
          repo: "owner/repo",
          branch: "main",
          dir: "questions",
          auth: { kind: "githubToken", secretRef: "gh-token" }
        },
        {
          id: "gd1",
          type: "gdrive",
          folderId: "folder_12345",
          auth: { kind: "httpHeader", secretRef: "gd-auth" }
        }
      ]
    };
    await putSourcesConfig(env, cfg);

    const res = await app.fetch(
      new Request("http://worker/admin/sources/export", {
        headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}` }
      }),
      env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.generatedAt).toBe("string");
    expect(body.config.sources[0].resolvedAuth.authorizationBearer).toBe("Bearer TOKEN123");
    expect(body.config.sources[1].resolvedAuth.headerLine).toBe("Authorization: Bearer <TOKEN>");
  });

  it("tests github source connectivity with resolved auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await putSecret(env, "gh-token", "TOKEN123");

    const cfg: SourcesConfigV1 = {
      version: "v1",
      courseCode: "c1",
      subject: "math",
      uidNamespace: "ns",
      sources: [
        {
          id: "gh1",
          type: "github",
          repo: "owner/repo",
          branch: "main",
          dir: "questions",
          auth: { kind: "githubToken", secretRef: "gh-token" }
        }
      ]
    };
    await putSourcesConfig(env, cfg);

    const res = await app.fetch(
      new Request("http://worker/admin/sources/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "gh1" })
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/owner/repo/zipball/main");
    expect((init as RequestInit).method).toBe("HEAD");
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer TOKEN123");
  });

  it("tests gdrive source connectivity with resolved auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ files: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await putSecret(env, "gd-auth", "Authorization: Bearer <TOKEN>");

    const cfg: SourcesConfigV1 = {
      version: "v1",
      courseCode: "c1",
      subject: "math",
      uidNamespace: "ns",
      sources: [
        {
          id: "gd1",
          type: "gdrive",
          folderId: "folder_12345",
          auth: { kind: "httpHeader", secretRef: "gd-auth" }
        }
      ]
    };
    await putSourcesConfig(env, cfg);

    const res = await app.fetch(
      new Request("http://worker/admin/sources/test", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "gd1" })
      }),
      env
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];

    const u = new URL("https://www.googleapis.com/drive/v3/files");
    u.searchParams.set("q", `'folder_12345' in parents and trashed=false`);
    u.searchParams.set("fields", "files(id)");
    u.searchParams.set("pageSize", "1");
    u.searchParams.set("supportsAllDrives", "true");
    u.searchParams.set("includeItemsFromAllDrives", "true");

    expect(url).toBe(u.toString());
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer <TOKEN>");
  });
});
