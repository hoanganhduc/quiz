import type { ChoiceKey, QuestionMcqAnswersV1 } from "@app/shared";
import { createRng, shuffle, sha256Hex } from "../utils";

type IdentityLike = { appUserId?: string; anonymousId?: string };

export function getIdentityKey(identity: IdentityLike): string {
  if (identity.appUserId) return `u:${identity.appUserId}`;
  if (identity.anonymousId) return `a:${identity.anonymousId}`;
  return "none";
}

function hashToInt(hex: string): number {
  return parseInt(hex.slice(0, 8), 16) >>> 0;
}

export async function computeVersionIndex(
  seed: string,
  identityKey: string,
  versionCount?: number
): Promise<number | undefined> {
  if (!versionCount) return undefined;
  const hash = await sha256Hex(`${seed}|${identityKey}`);
  const hashInt = hashToInt(hash);
  return hashInt % versionCount;
}

export async function computeVersionId(
  examId: string,
  seed: string,
  identityKey: string,
  versionIndex?: number
): Promise<string> {
  const hash = await sha256Hex(`${examId}|${seed}|${identityKey}|${versionIndex ?? "unique"}`);
  return hash.slice(0, 12);
}

export function makeVersionSeed(seed: string, identityKey: string, versionIndex?: number): string {
  return `${seed}|${identityKey}|${versionIndex ?? "u"}`;
}

export function deterministicShuffle<T>(array: T[], seedString: string): T[] {
  const rng = createRng(seedString);
  return shuffle(array, rng);
}

export function shuffleChoicesForQuestion(
  question: QuestionMcqAnswersV1,
  versionSeed: string
): { choices: { key: ChoiceKey; text: string }[]; displayedCorrectKey: ChoiceKey } { 
  const perQuestionSeed = `${versionSeed}|${question.uid}`;
  const n = question.choices.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  const shuffledIndices = deterministicShuffle(indices, perQuestionSeed);
  const displayedKeys = (["A", "B", "C", "D", "E"] as ChoiceKey[]).slice(0, n);
  const displayedChoices = shuffledIndices.map((idx, displayIdx) => {
    const choice = question.choices[idx];
    const key = displayedKeys[displayIdx];
    return { key, text: choice.text };
  });
  const correctOriginalIndex = question.choices.findIndex((c) => c.key === question.answerKey);
  const displayedCorrectIdx = shuffledIndices.findIndex((idx) => idx === correctOriginalIndex);
  const displayedCorrectKey = displayedKeys[displayedCorrectIdx];
  return { choices: displayedChoices, displayedCorrectKey };
}
