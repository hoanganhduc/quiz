import { describe, expect, it, beforeEach } from "vitest";
import { webcrypto as nodeCrypto } from "crypto";
import type { Env } from "../../src/env";
import { deleteSecret, getSecretPlaintext, listSecrets, putSecret } from "../../src/secrets/store";

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

  dumpRaw(key: string): string | null {
    return this.store.get(key) ?? null;
  }
}

function makeEnv(): Env {
  const rawKey = nodeCrypto.getRandomValues(new Uint8Array(32));
  const keyB64 = Buffer.from(rawKey).toString("base64");
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
    CONFIG_ENC_KEY_B64: keyB64
  };
}

describe("secret store", () => {
  let env: Env;

  beforeEach(() => {
    env = makeEnv();
  });

  it("put/get/list/delete roundtrip", async () => {
    await putSecret(env, "my-secret", "super-plaintext");
    const listed = await listSecrets(env);
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("my-secret");

    const plaintext = await getSecretPlaintext(env, "my-secret");
    expect(plaintext).toBe("super-plaintext");

    await deleteSecret(env, "my-secret");
    const afterDelete = await getSecretPlaintext(env, "my-secret");
    expect(afterDelete).toBeNull();
  });

  it("does not store plaintext", async () => {
    await putSecret(env, "hidden", "top-secret");
    const raw = (env.QUIZ_KV as MemoryKV).dumpRaw("secret:hidden");
    expect(raw).toBeTruthy();
    expect(raw!.includes("top-secret")).toBe(false);
  });
});
