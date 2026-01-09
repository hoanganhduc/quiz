import { describe, expect, it } from "vitest";
import type { AppUser } from "@app/shared";
import { createUserWithProvider, getAppUserIdByProvider, getUser, linkProviderToUser, updateLinkedProvider } from "../src/users/store";

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
};

function makeEnv(): TestEnv {
  return { QUIZ_KV: new MemoryKV() };
}

describe("user store", () => {
  it("creates user and links provider", async () => {
    const env = makeEnv();
    const user = await createUserWithProvider(
      env as any,
      "github",
      "gh-123",
      { userId: "gh-123", username: "octo" },
      { displayName: "Octo" }
    );

    const stored = await getUser(env as any, user.appUserId);
    expect(stored?.linked.github?.userId).toBe("gh-123");

    const mapping = await getAppUserIdByProvider(env as any, "github", "gh-123");
    expect(mapping).toBe(user.appUserId);
  });

  it("links a new provider to existing user", async () => {
    const env = makeEnv();
    const user = await createUserWithProvider(
      env as any,
      "github",
      "gh-abc",
      { userId: "gh-abc" },
      {}
    );

    await linkProviderToUser(env as any, "google", "google-sub", user.appUserId);

    const updated = await updateLinkedProvider(env as any, user as AppUser, "google", {
      sub: "google-sub",
      email: "g@example.com"
    });

    const mapping = await getAppUserIdByProvider(env as any, "google", "google-sub");
    expect(mapping).toBe(user.appUserId);
    expect(updated.linked.google?.sub).toBe("google-sub");
  });

  it("throws conflict when provider already linked", async () => {
    const env = makeEnv();
    const userA = await createUserWithProvider(
      env as any,
      "github",
      "gh-1",
      { userId: "gh-1" },
      {}
    );
    const userB = await createUserWithProvider(
      env as any,
      "google",
      "g-1",
      { sub: "g-1" },
      {}
    );

    await expect(linkProviderToUser(env as any, "github", "gh-1", userB.appUserId)).rejects.toMatchObject({
      status: 409
    });

    const mapping = await getAppUserIdByProvider(env as any, "github", "gh-1");
    expect(mapping).toBe(userA.appUserId);
  });
});
