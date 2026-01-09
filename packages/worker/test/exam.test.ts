import app from "../src/index";
import { describe, expect, it, beforeEach } from "vitest";
import type { BankAnswersV1, BankPublicV1, ChoiceKey } from "@app/shared";
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
const q2 = makeUid("MAT3500", "topic1:q2");

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
    },
    {
      uid: q2,
      subject,
      type: "mcq-single" as const,
      id: "topic1:q2",
      topic: "topic1",
      level: "advanced" as const,
      number: 2,
      prompt: "Q2",
      choices: [
        { key: "A", text: "a2" },
        { key: "B", text: "b2" }
      ]
    }
  ];
  const questionsAns = [
    { ...questionsPublic[0], answerKey: "A" as ChoiceKey, solution: "sol1" },
    { ...questionsPublic[1], answerKey: "B" as ChoiceKey, solution: "sol2" }
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

async function createExam(env: TestEnv, policy: any, extra?: Partial<{ codes: string[]; seed: string }>) {
  const body = {
    subject,
    composition: [
      { topic: "topic1", level: "basic", n: 1 },
      { topic: "topic1", level: "advanced", n: 1 }
    ],
    policy,
    codes: extra?.codes,
    seed: extra?.seed
  };
  const res = await app.fetch(new Request("http://worker/admin/exams", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.ADMIN_TOKEN}`
    },
    body: JSON.stringify(body)
  }), env);
  expect(res.status).toBe(200);
  const json = await res.json() as { examId: string; seed: string };
  return json.examId;
}

async function getCookieFromAnonymous(env: TestEnv) {
  const res = await app.fetch(new Request("http://worker/auth/anonymous", { method: "POST" }), env);
  expect(res.status).toBe(200);
  const cookie = res.headers.get("Set-Cookie");
  expect(cookie).toBeTruthy();
  return cookie!;
}

describe("exam routes", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    await seedBanks(env);
  });

  it("enforces auth when required", async () => {
    const examId = await createExam(env, {
      authMode: "required",
      requireViewCode: false,
      requireSubmitCode: false,
      solutionsMode: "never"
    });

    const resNoAuth = await app.fetch(new Request(`http://worker/exam/${examId}/config`), env);
    expect(resNoAuth.status).toBe(401);

    const cookie = await getCookieFromAnonymous(env);
    const resWithAuth = await app.fetch(new Request(`http://worker/exam/${examId}/config`, {
      headers: { Cookie: cookie }
    }), env);
    expect(resWithAuth.status).toBe(200);
    const json = await resWithAuth.json();
    expect(json.auth).toBe("anon");
  });

  it("enforces view and submit codes", async () => {
    const examId = await createExam(env, {
      authMode: "none",
      requireViewCode: true,
      requireSubmitCode: true,
      solutionsMode: "never"
    }, { codes: ["secret"] });

    const bankNoCode = await app.fetch(new Request(`http://worker/exam/${examId}/bank`), env);
    expect(bankNoCode.status).toBe(403);

    const bankOk = await app.fetch(new Request(`http://worker/exam/${examId}/bank?code=secret`), env);
    expect(bankOk.status).toBe(200);

    const submitBad = await app.fetch(new Request(`http://worker/exam/${examId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: {} })
    }), env);
    expect(submitBad.status).toBe(403);

    const submitOk = await app.fetch(new Request(`http://worker/exam/${examId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: {}, code: "secret" })
    }), env);
    expect(submitOk.status).toBe(200);
  });

  it("grades submissions correctly", async () => {
    const examId = await createExam(env, {
      authMode: "none",
      requireViewCode: false,
      requireSubmitCode: false,
      solutionsMode: "after_submit"
    });

    const body = {
      answers: {
        [q1]: "A",
        [q2]: "A"
      }
    };
    const res = await app.fetch(new Request(`http://worker/exam/${examId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }), env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.submission.score).toEqual({ correct: 1, total: 2 });
    const q1Res = json.submission.perQuestion.find((p: any) => p.uid === q1);
    const q2Res = json.submission.perQuestion.find((p: any) => p.uid === q2);
    expect(q1Res.correct).toBe(true);
    expect(q2Res.correct).toBe(false);
  });

  it("respects solutionsMode", async () => {
    const examNever = await createExam(env, {
      authMode: "none",
      requireViewCode: false,
      requireSubmitCode: false,
      solutionsMode: "never"
    });
    const bankNever = await app.fetch(new Request(`http://worker/exam/${examNever}/bank`), env);
    const bankNeverJson = await bankNever.json() as any;
    expect(bankNeverJson.questions.every((q: any) => q.answerKey === undefined)).toBe(true);

    const submitNever = await app.fetch(new Request(`http://worker/exam/${examNever}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { [q1]: "A", [q2]: "B" } })
    }), env);
    const submitNeverJson = await submitNever.json() as any;
    expect(submitNeverJson.submission.perQuestion.every((q: any) => q.answerKey === undefined)).toBe(true);

    const examAlways = await createExam(env, {
      authMode: "none",
      requireViewCode: false,
      requireSubmitCode: false,
      solutionsMode: "always"
    });
    const bankAlways = await app.fetch(new Request(`http://worker/exam/${examAlways}/bank`), env);
    const bankAlwaysJson = await bankAlways.json() as any;
    expect(bankAlwaysJson.questions.every((q: any) => q.answerKey !== undefined && q.solution)).toBe(true);

    const submitAlways = await app.fetch(new Request(`http://worker/exam/${examAlways}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { [q1]: "A", [q2]: "B" } })
    }), env);
    const submitAlwaysJson = await submitAlways.json() as any;
    expect(submitAlwaysJson.submission.perQuestion.every((q: any) => q.answerKey && q.solution)).toBe(true);
  });
});
