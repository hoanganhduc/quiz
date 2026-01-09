import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { makeUid, type BankAnswersV1, type BankPublicV1 } from "@app/shared";

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
  const base = { version: "v1" as const, subject: subject as const, generatedAt };
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
        { key: "B", text: "b1" },
        { key: "C", text: "c1" },
        { key: "D", text: "d1" }
      ]
    }
  ];
  const questionsAns = [{ ...questionsPublic[0], answerKey: "A" as const, solution: "sol1" }];
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

const basePolicy = {
  authMode: "none" as const,
  requireViewCode: false,
  requireSubmitCode: false,
  solutionsMode: "never" as const
};

describe("admin exam policy defaults", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    await seedBanks(env);
  });

  it("applies fixed version defaults when omitted", async () => {
    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ADMIN_TOKEN}`
        },
        body: JSON.stringify({
          subject,
          composition: [{ topic: "topic1", level: "basic", n: 1 }],
          policy: basePolicy
        })
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { examId: string };

    const config = await app.fetch(new Request(`http://worker/exam/${body.examId}/config`), env);
    expect(config.status).toBe(200);
    const cfg = (await config.json()) as any;
    expect(cfg.policy.versioningMode).toBe("fixed");
    expect(cfg.policy.shuffleQuestions).toBe(false);
    expect(cfg.policy.shuffleChoices).toBe(false);
    expect(cfg.policy.versionCount).toBeUndefined();
  });

  it("applies per_student defaults and preserves versionCount", async () => {
    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ADMIN_TOKEN}`
        },
        body: JSON.stringify({
          subject,
          composition: [{ topic: "topic1", level: "basic", n: 1 }],
          policy: { ...basePolicy, versioningMode: "per_student", versionCount: 3 }
        })
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { examId: string };

    const config = await app.fetch(new Request(`http://worker/exam/${body.examId}/config`), env);
    expect(config.status).toBe(200);
    const cfg = (await config.json()) as any;
    expect(cfg.policy.versioningMode).toBe("per_student");
    expect(cfg.policy.shuffleQuestions).toBe(true);
    expect(cfg.policy.shuffleChoices).toBe(false);
    expect(cfg.policy.versionCount).toBe(3);
  });

  it("rejects invalid versionCount", async () => {
    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ADMIN_TOKEN}`
        },
        body: JSON.stringify({
          subject,
          composition: [{ topic: "topic1", level: "basic", n: 1 }],
          policy: { ...basePolicy, versionCount: 1 }
        })
      }),
      env
    );
    expect(res.status).toBe(400);
  });
});
