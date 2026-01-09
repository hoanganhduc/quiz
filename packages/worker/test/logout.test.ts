import { describe, expect, it } from "vitest";
import app from "../src/index";

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

const env: TestEnv = {
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

describe("logout", () => {
  it("clears session cookie", async () => {
    const res = await app.fetch(new Request("http://worker/auth/logout", { method: "POST" }), env);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("quiz_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Path=/");
  });
});
