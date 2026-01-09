import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import type { BankAnswersV1, BankPublicV1, ChoiceKey, SessionV2 } from "@app/shared";
import { makeUid } from "@app/shared";
import { issueSessionCookie } from "../src/session";

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

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<KVNamespaceListResult> {
    const prefix = options?.prefix ?? "";
    const limit = options?.limit ?? 1000;
    const keys = Array.from(this.store.keys())
      .filter((key) => key.startsWith(prefix))
      .sort()
      .slice(0, limit)
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

const subject = "discrete-math";
const q1 = makeUid("MAT3500", "topic1:q1");

function banks(): { pub: BankPublicV1; ans: BankAnswersV1 } {
  const generatedAt = new Date().toISOString();
  const base = {
    version: "v1" as const,
    subject: "discrete-math" as const,
    generatedAt
  };
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
    { ...questionsPublic[0], answerKey: "A" as ChoiceKey, solution: "sol1" }
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

async function createExam(env: TestEnv) {
  const body = {
    subject,
    composition: [{ topic: "topic1", level: "basic", n: 1 }],
    policy: {
      authMode: "none",
      requireViewCode: false,
      requireSubmitCode: false,
      solutionsMode: "never"
    }
  };
  const res = await app.fetch(
    new Request("http://worker/admin/exams", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.ADMIN_TOKEN}`
      },
      body: JSON.stringify(body)
    }),
    env
  );
  expect(res.status).toBe(200);
  const json = (await res.json()) as { examId: string };
  return json.examId;
}

async function submitExam(env: TestEnv, examId: string, cookie: string) {
  const body = { answers: { [q1]: "A" as ChoiceKey } };
  const res = await app.fetch(
    new Request(`http://worker/exam/${examId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body)
    }),
    env
  );
  expect(res.status).toBe(200);
  const json = (await res.json()) as { submission: { submissionId: string } };
  return json.submission.submissionId;
}

describe("submission history", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    await seedBanks(env);
  });

  it("lists submissions for logged-in user", async () => {
    const examId = await createExam(env);
    const session: SessionV2 = {
      appUserId: crypto.randomUUID(),
      roles: [],
      providers: ["github"],
      displayName: "User"
    };
    const cookie = await issueSessionCookie(env as any, new Request("http://worker"), session);
    const submissionId = await submitExam(env, examId, cookie);

    const listRes = await app.fetch(
      new Request("http://worker/me/submissions?limit=10", { headers: { Cookie: cookie } }),
      env
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { items: { submissionId: string }[] };
    expect(listJson.items.some((item) => item.submissionId === submissionId)).toBe(true);
  });

  it("restricts submission detail to owner", async () => {
    const examId = await createExam(env);
    const sessionA: SessionV2 = {
      appUserId: crypto.randomUUID(),
      roles: [],
      providers: ["github"],
      displayName: "User A"
    };
    const cookieA = await issueSessionCookie(env as any, new Request("http://worker"), sessionA);
    const submissionId = await submitExam(env, examId, cookieA);

    const sessionB: SessionV2 = {
      appUserId: crypto.randomUUID(),
      roles: [],
      providers: ["github"],
      displayName: "User B"
    };
    const cookieB = await issueSessionCookie(env as any, new Request("http://worker"), sessionB);

    const detailRes = await app.fetch(
      new Request(`http://worker/me/submissions/${submissionId}`, { headers: { Cookie: cookieB } }),
      env
    );
    expect(detailRes.status).toBe(403);

    const okRes = await app.fetch(
      new Request(`http://worker/me/submissions/${submissionId}`, { headers: { Cookie: cookieA } }),
      env
    );
    expect(okRes.status).toBe(200);
  });
});
