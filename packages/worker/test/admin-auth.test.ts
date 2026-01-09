import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { putUser } from "../src/users/store";
import { issueSessionCookie } from "../src/session";
import type { AppUser, BankAnswersV1, BankPublicV1, SessionV2 } from "@app/shared";
import { makeUid } from "@app/shared";

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

const subject = "discrete-math";
const q1 = makeUid("MAT3500", "topic1:q1");

function banks(): { pub: BankPublicV1; ans: BankAnswersV1 } {
  const generatedAt = new Date().toISOString();
  const base = { version: "v1" as const, subject: "discrete-math" as const, generatedAt };
  const questionsPublic = [
    {
      uid: q1,
      subject,
      type: "mcq-single" as const,
      id: "topic1:q1",
      topic: "topic1",
      level: "basic" as const,
      number: 1,
      prompt: "Q1",
      choices: [
        { key: "A", text: "a1" },
        { key: "B", text: "b1" }
      ]
    }
  ];
  const questionsAns = [
    { ...questionsPublic[0], answerKey: "A" as const, solution: "sol1" }
  ];
  return {
    pub: { ...base, questions: questionsPublic },
    ans: { ...base, questions: questionsAns }
  };
}

async function seedBanks(env: TestEnv) {
  const { pub, ans } = banks();
  await env.QUIZ_KV.put(`banks:${subject}:latest:public`, JSON.stringify(pub));
  await env.QUIZ_KV.put(`banks:${subject}:latest:answers`, JSON.stringify(ans));
}

const examBody = {
  subject,
  composition: [{ topic: "topic1", level: "basic", n: 1 }],
  policy: {
    authMode: "none",
    requireViewCode: false,
    requireSubmitCode: false,
    solutionsMode: "never"
  }
};

describe("admin authorization", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    await seedBanks(env);
  });

  it("returns 403 for non-admin user", async () => {
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

    const session: SessionV2 = {
      appUserId,
      roles: [],
      providers: ["anon"],
      displayName: "Anon"
    };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(examBody)
      }),
      env
    );
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

    const session: SessionV2 = {
      appUserId,
      roles: ["admin"],
      providers: ["anon"],
      displayName: "Admin"
    };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);

    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(examBody)
      }),
      env
    );
    expect(res.status).toBe(200);
  });

  it("allows bearer admin token", async () => {
    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ADMIN_TOKEN}`
        },
        body: JSON.stringify(examBody)
      }),
      env
    );
    expect(res.status).toBe(200);
  });
});
