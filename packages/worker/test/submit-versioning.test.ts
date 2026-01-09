import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/index";
import {
  makeUid,
  type BankAnswersV1,
  type BankPublicV1,
  type SessionV2
} from "@app/shared";
import { issueSessionCookie } from "../src/session";
import {
  computeVersionIndex,
  makeVersionSeed,
  shuffleChoicesForQuestion
} from "../src/exam/versioning";

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
  const questionsAns = [{ ...questionsPublic[0], answerKey: "C" as const, solution: "sol1" }];
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

const composition = [{ topic: "topic1", level: "basic" as const, n: 1 }];

function sessionCookie(appUserId: string, env: TestEnv) {
  const session: SessionV2 = {
    appUserId,
    roles: [],
    providers: ["github"],
    displayName: "User"
  };
  return issueSessionCookie(env as any, new Request("http://worker"), session);
}

describe("submission grading with shuffled choices", () => {
  let env: TestEnv;

  beforeEach(async () => {
    env = { ...baseEnv, QUIZ_KV: new MemoryKV() };
    await seedBanks(env);
  });

  it("grades against shuffled choice order deterministically", async () => {
    const adminRes = await app.fetch(
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
            solutionsMode: "after_submit",
            versioningMode: "per_student",
            versionCount: 4,
            shuffleChoices: true,
            shuffleQuestions: false
          }
        })
      }),
      env
    );
    expect(adminRes.status).toBe(200);
    const created = (await adminRes.json()) as { examId: string; seed: string };

    const cookie = await sessionCookie("user-1", env);
    const identityKey = `u:user-1`;
    const versionIndex = await computeVersionIndex(created.seed, identityKey, 4);
    const versionSeed = makeVersionSeed(created.seed, identityKey, versionIndex);
    const correctKey = shuffleChoicesForQuestion(banks().ans.questions[0], versionSeed).displayedCorrectKey;

    const submitRes = await app.fetch(
      new Request(`http://worker/exam/${created.examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ answers: { [q1]: correctKey } })
      }),
      env
    );
    expect(submitRes.status).toBe(200);
    const body = (await submitRes.json()) as any;
    expect(body.submission.score.correct).toBe(1);
    expect(body.submission.version.versionIndex).toBe(versionIndex);
  });
});
