import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import { makeUid, type BankAnswersV1, type BankPublicV1, type SessionV2 } from "@app/shared";
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
    },
    {
      uid: q2,
      subject,
      type: "mcq-single" as const,
      id: "topic1:q2",
      topic: "topic1",
      level: "basic" as const,
      number: 2,
      prompt: "Q2",
      choices: [
        { key: "A", text: "a2" },
        { key: "B", text: "b2" },
        { key: "C", text: "c2" },
        { key: "D", text: "d2" }
      ]
    }
  ];
  const questionsAns = [
    { ...questionsPublic[0], answerKey: "A" as const, solution: "sol1" },
    { ...questionsPublic[1], answerKey: "B" as const, solution: "sol2" }
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

const composition = [{ topic: "topic1", level: "basic" as const, n: 2 }];

function sessionCookie(appUserId: string, env: TestEnv) {
  const session: SessionV2 = {
    appUserId,
    roles: [],
    providers: ["github"],
    displayName: "User"
  };
  return issueSessionCookie(env as any, new Request("http://worker"), session);
}

describe("exam bank versioning", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    await seedBanks(env);
  });

  it("returns stable version for fixed mode", async () => {
    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ADMIN_TOKEN}`
        },
        body: JSON.stringify({
          subject,
          composition,
          policy: {
            authMode: "none",
            requireViewCode: false,
            requireSubmitCode: false,
            solutionsMode: "never"
          }
        })
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { examId: string };

    const bank1 = await app.fetch(new Request(`http://worker/exam/${body.examId}/bank`), env);
    const bank2 = await app.fetch(new Request(`http://worker/exam/${body.examId}/bank`), env);
    expect(bank1.status).toBe(200);
    expect(bank2.status).toBe(200);
    const b1 = (await bank1.json()) as any;
    const b2 = (await bank2.json()) as any;
    expect(b1.version.versionId).toBe(b2.version.versionId);
    expect(b1.questions.map((q: any) => q.uid)).toEqual(b2.questions.map((q: any) => q.uid));
  });

  it("varies version for different identities in per_student mode", async () => {
    const res = await app.fetch(
      new Request("http://worker/admin/exams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ADMIN_TOKEN}`
        },
        body: JSON.stringify({
          subject,
          composition,
          policy: {
            authMode: "none",
            requireViewCode: false,
            requireSubmitCode: false,
            solutionsMode: "never",
            versioningMode: "per_student",
            versionCount: 3,
            shuffleQuestions: true,
            shuffleChoices: true
          }
        })
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { examId: string };

    const cookie1 = await sessionCookie("user-1", env);
    const cookie2 = await sessionCookie("user-2", env);

    const bank1 = await app.fetch(
      new Request(`http://worker/exam/${body.examId}/bank`, { headers: { Cookie: cookie1 } }),
      env
    );
    const bank2 = await app.fetch(
      new Request(`http://worker/exam/${body.examId}/bank`, { headers: { Cookie: cookie2 } }),
      env
    );
    expect(bank1.status).toBe(200);
    expect(bank2.status).toBe(200);
    const b1 = (await bank1.json()) as any;
    const b2 = (await bank2.json()) as any;
    expect(b1.version.versionId).not.toBe(b2.version.versionId);
  });
});
