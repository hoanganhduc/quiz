import { beforeEach, describe, expect, it } from "vitest";
import type { Env } from "../../src/env";
import { DEFAULT_SOURCES_CONFIG, getSourcesConfig, putSourcesConfig } from "../../src/sources/store";
import type { SourcesConfigV1 } from "@app/shared";

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

function makeEnv(): Env {
  return {
    QUIZ_KV: new MemoryKV(),
    ADMIN_TOKEN: "adm",
    JWT_SECRET: "jwt",
    CODE_PEPPER: "pep",
    UI_ORIGIN: "http://localhost",
    GITHUB_CLIENT_ID: "gh-id",
    GITHUB_CLIENT_SECRET: "gh-secret",
    GOOGLE_CLIENT_ID: "g-id",
    GOOGLE_CLIENT_SECRET: "g-secret",
    CONFIG_ENC_KEY_B64: Buffer.from(new Uint8Array(32)).toString("base64")
  };
}

describe("sources store", () => {
  let env: Env;

  beforeEach(() => {
    env = makeEnv();
  });

  it("returns default when missing", async () => {
    const cfg = await getSourcesConfig(env);
    expect(cfg).toEqual(DEFAULT_SOURCES_CONFIG);
  });

  it("put/get roundtrip", async () => {
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
          dir: "questions"
        }
      ]
    };

    await putSourcesConfig(env, cfg);
    const loaded = await getSourcesConfig(env);
    expect(loaded).toEqual(cfg);
  });

  it("rejects invalid config", async () => {
    const badCfg: any = {
      version: "v1",
      courseCode: "c1",
      subject: "math",
      uidNamespace: "ns",
      sources: [
        {
          id: "bad",
          type: "github",
          repo: "not-valid",
          branch: "main",
          dir: "questions"
        }
      ]
    };
    await expect(putSourcesConfig(env, badCfg)).rejects.toThrow();
  });
});
