import { beforeEach, describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import { resolveForBuild } from "../../src/sources/resolve";
import { putSecret } from "../../src/secrets/store";
import { putSourcesConfig } from "../../src/sources/store";
import type { SourcesConfigV1 } from "@app/shared";
import { webcrypto as nodeCrypto } from "crypto";

class MemoryKV {
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

  dump(key: string): string | null {
    return this.store.get(key) ?? null;
  }
}

class MemoryR2 {
  async head(): Promise<any | null> { return null; }
  async get(): Promise<any | null> { return null; }
  async put(): Promise<any> { return {} as any; }
  async delete(): Promise<void> { }
  async list(): Promise<any> { return { objects: [], truncated: false, cursor: "", delimitedPrefixes: [] }; }
}

function makeEnv(): Env {
  const rawKey = nodeCrypto.getRandomValues(new Uint8Array(32));
  return {
    QUIZ_KV: new MemoryKV() as any,
    UPLOADS_BUCKET: new MemoryR2() as any,
    ADMIN_TOKEN: "adm",
    JWT_SECRET: "jwt",
    CODE_PEPPER: "pep",
    UI_ORIGIN: "http://localhost",
    GITHUB_CLIENT_ID: "gh-id",
    GITHUB_CLIENT_SECRET: "gh-secret",
    GOOGLE_CLIENT_ID: "g-id",
    GOOGLE_CLIENT_SECRET: "g-secret",
    CONFIG_ENC_KEY_B64: Buffer.from(rawKey).toString("base64")
  };
}

describe("resolveForBuild", () => {
  let env: Env;

  beforeEach(() => {
    env = makeEnv();
  });

  it("injects resolvedAuth with plaintext", async () => {
    await putSecret(env, "gh-token", "SECRET_TOKEN");
    const cfg: any = {
      version: "v1",
      courseCode: "c1",
      subjects: [{ id: "math", title: "Mathematics" }],
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
          id: "zip1",
          type: "zip",
          url: "https://example.com/archive.zip",
          dir: "data",
          auth: { kind: "httpHeader", secretRef: "gh-token" }
        },
        {
          id: "gd1",
          type: "gdrive",
          folderId: "folder_12345",
          auth: { kind: "httpHeader", secretRef: "gh-token" }
        }
      ]
    };

    const resolved = await resolveForBuild(env, cfg);
    const gh = resolved.sources.find((s) => s.id === "gh1") as any;
    const zip = resolved.sources.find((s) => s.id === "zip1") as any;
    const gd = resolved.sources.find((s) => s.id === "gd1") as any;
    expect(gh?.resolvedAuth).toEqual({ authorizationBearer: "Bearer SECRET_TOKEN" });
    expect(zip?.resolvedAuth).toEqual({ headerLine: "SECRET_TOKEN" });
    expect(gd?.resolvedAuth).toEqual({ headerLine: "SECRET_TOKEN" });
  });

  it("stored config never contains resolvedAuth", async () => {
    await putSecret(env, "gh-token", "SECRET_TOKEN");
    const cfg: any = {
      version: "v1",
      courseCode: "c1",
      subjects: [{ id: "math", title: "Mathematics" }],
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
    const raw = (env.QUIZ_KV as MemoryKV).dump("sources:v1");
    expect(raw).toBeTruthy();
    expect(raw?.includes("resolvedAuth")).toBe(false);
  });
});
