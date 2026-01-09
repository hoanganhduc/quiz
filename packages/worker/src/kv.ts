import {
  BankAnswersV1,
  BankAnswersV1Schema,
  BankPublicV1,
  BankPublicV1Schema,
  ExamV1,
  ExamV1Schema,
  SubmissionV1,
  SubmissionV1Schema
} from "@app/shared";
import type { Env } from "./env";

export type KVResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
type SafeSchema<T> = { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: unknown } };

const latestPublicKey = (subject: string) => `banks:${subject}:latest:public`;
const latestAnswersKey = (subject: string) => `banks:${subject}:latest:answers`;
const examKey = (examId: string) => `exam:${examId}`;
const submissionKey = (examId: string, submissionId: string) => `sub:${examId}:${submissionId}`;

async function parseFromKV<T>(
  env: Env,
  key: string,
  schema: SafeSchema<T>,
  label: string
): Promise<KVResult<T>> {
  const raw = await env.QUIZ_KV.get(key);
  if (!raw) {
    return { ok: false, status: 404, error: `${label} not found` };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, error: `${label} is not valid JSON` };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, status: 400, error: `${label} failed validation` };
  }

  return { ok: true, value: parsed.data };
}

export async function getLatestBanks(
  env: Env,
  subject: string
): Promise<KVResult<{ publicBank: BankPublicV1; answersBank: BankAnswersV1 }>> {
  const pubKey = latestPublicKey(subject);
  const ansKey = latestAnswersKey(subject);

  const pub = await parseFromKV(env, pubKey, BankPublicV1Schema, "Latest public bank");
  if (!pub.ok) return pub;

  const ans = await parseFromKV(env, ansKey, BankAnswersV1Schema, "Latest answers bank");
  if (!ans.ok) return ans;

  return { ok: true, value: { publicBank: pub.value, answersBank: ans.value } };
}

export async function putBanks(
  env: Env,
  subject: string,
  publicBank: BankPublicV1,
  answersBank: BankAnswersV1
): Promise<KVResult<void>> {
  const publicParsed = BankPublicV1Schema.safeParse(publicBank);
  if (!publicParsed.success) {
    return { ok: false, status: 400, error: "Public bank failed validation" };
  }
  const answersParsed = BankAnswersV1Schema.safeParse(answersBank);
  if (!answersParsed.success) {
    return { ok: false, status: 400, error: "Answers bank failed validation" };
  }

  await env.QUIZ_KV.put(latestPublicKey(subject), JSON.stringify(publicParsed.data));
  await env.QUIZ_KV.put(latestAnswersKey(subject), JSON.stringify(answersParsed.data));
  return { ok: true, value: undefined };
}

export async function getExam(env: Env, examId: string): Promise<KVResult<ExamV1>> {
  return parseFromKV(env, examKey(examId), ExamV1Schema, "Exam");
}

export async function putExam(env: Env, exam: ExamV1): Promise<KVResult<void>> {
  const parsed = ExamV1Schema.safeParse(exam);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Exam failed validation" };
  }
  await env.QUIZ_KV.put(examKey(exam.examId), JSON.stringify(parsed.data));
  return { ok: true, value: undefined };
}

export async function putSubmission(env: Env, submission: SubmissionV1): Promise<KVResult<void>> {
  const parsed = SubmissionV1Schema.safeParse(submission);
  if (!parsed.success) {
    return { ok: false, status: 400, error: "Submission failed validation" };
  }
  const key = submissionKey(submission.examId, submission.submissionId);
  await env.QUIZ_KV.put(key, JSON.stringify(parsed.data));
  return { ok: true, value: undefined };
}
