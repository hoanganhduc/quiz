import { SessionV2Schema, SubmissionSummaryV1Schema, type SubmissionSummaryV1 } from "@app/shared";
import type { Env } from "../env";

const USER_SUB_PREFIX = "userSub";
const SUBID_PREFIX = "subid";

const ownerAppUserIdSchema = SessionV2Schema.shape.appUserId;

type SubmissionOwnerMap = { examId: string; ownerAppUserId: string };

function tsInv13(epochMs: number): string {
  const inv = 9999999999999 - epochMs;
  return String(inv).padStart(13, "0");
}

export function makeTsInv13(epochMs: number): string {
  return tsInv13(epochMs);
}

export async function putUserSubmissionIndex(
  env: Env,
  appUserId: string,
  summary: SubmissionSummaryV1
): Promise<void> {
  const parsed = SubmissionSummaryV1Schema.safeParse(summary);
  if (!parsed.success) {
    throw new Error("Submission summary failed validation");
  }
  const appUserParsed = ownerAppUserIdSchema.safeParse(appUserId);
  if (!appUserParsed.success) {
    throw new Error("appUserId failed validation");
  }
  const submittedAt = Date.parse(parsed.data.submittedAt);
  if (Number.isNaN(submittedAt)) {
    throw new Error("submittedAt invalid");
  }
  const key = `${USER_SUB_PREFIX}:${appUserParsed.data}:${tsInv13(submittedAt)}:${parsed.data.submissionId}`;
  await env.QUIZ_KV.put(key, JSON.stringify(parsed.data));
}

export async function putSubmissionOwnerMap(
  env: Env,
  submissionId: string,
  mapping: SubmissionOwnerMap
): Promise<void> {
  const ownerParsed = ownerAppUserIdSchema.safeParse(mapping.ownerAppUserId);
  if (!ownerParsed.success) {
    throw new Error("ownerAppUserId failed validation");
  }
  if (!mapping.examId) {
    throw new Error("examId missing");
  }
  const key = `${SUBID_PREFIX}:${submissionId}`;
  await env.QUIZ_KV.put(key, JSON.stringify({ examId: mapping.examId, ownerAppUserId: ownerParsed.data }));
}

export async function getSubmissionOwnerMap(
  env: Env,
  submissionId: string
): Promise<SubmissionOwnerMap | null> {
  const key = `${SUBID_PREFIX}:${submissionId}`;
  const raw = await env.QUIZ_KV.get(key);
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("subid mapping invalid JSON");
  }
  if (!json || typeof json !== "object") {
    throw new Error("subid mapping invalid");
  }
  const value = json as { examId?: unknown; ownerAppUserId?: unknown };
  const examIdOk = typeof value.examId === "string";
  const ownerOk = ownerAppUserIdSchema.safeParse(value.ownerAppUserId).success;
  if (!examIdOk || !ownerOk) {
    throw new Error("subid mapping failed validation");
  }
  return { examId: value.examId as string, ownerAppUserId: value.ownerAppUserId as string };
}

export async function listUserSubmissionIndex(
  env: Env,
  appUserId: string,
  limit = 20,
  cursor?: string
): Promise<{ items: SubmissionSummaryV1[]; cursor?: string }> {
  const appUserParsed = ownerAppUserIdSchema.safeParse(appUserId);
  if (!appUserParsed.success) {
    throw new Error("appUserId failed validation");
  }
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const list = await env.QUIZ_KV.list({
    prefix: `${USER_SUB_PREFIX}:${appUserParsed.data}:`,
    limit: safeLimit,
    cursor
  });
  const items: SubmissionSummaryV1[] = [];
  for (const key of list.keys) {
    const raw = await env.QUIZ_KV.get(key.name);
    if (!raw) continue;
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      continue;
    }
    const parsed = SubmissionSummaryV1Schema.safeParse(json);
    if (!parsed.success) continue;
    items.push(parsed.data);
  }
  return {
    items,
    cursor: list.list_complete ? undefined : list.cursor
  };
}
