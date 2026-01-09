import { z } from "zod";
import type { AnswerDraftV1, AnswerValueV1 } from "@app/shared";

const DraftSchema = z.object({
  version: z.literal("v1"),
  examId: z.string(),
  versionId: z.string(),
  savedAtISO: z.string(),
  answers: z.record(
    z.string(),
    z.union([z.enum(["A", "B", "C", "D", "E"]), z.array(z.string())])
  )
});

export function makeDraftKey(examId: string, versionId: string): string {
  return `quiz:draft:v1:${examId}:${versionId}`;
}

export function loadDraft(examId: string, versionId: string): AnswerDraftV1 | null {
  try {
    const raw = localStorage.getItem(makeDraftKey(examId, versionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const draft = DraftSchema.parse(parsed);
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(examId: string, versionId: string, answers: Record<string, AnswerValueV1>): void {
  try {
    const payload: AnswerDraftV1 = {
      version: "v1",
      examId,
      versionId,
      savedAtISO: new Date().toISOString(),
      answers
    };
    localStorage.setItem(makeDraftKey(examId, versionId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function clearDraft(examId: string, versionId: string): void {
  try {
    localStorage.removeItem(makeDraftKey(examId, versionId));
  } catch {
    // ignore storage errors
  }
}
