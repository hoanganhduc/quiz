import { describe, it, expect } from "vitest";
import type { ChoiceKey } from "@app/shared";
import {
  computeVersionId,
  computeVersionIndex,
  deterministicShuffle,
  getIdentityKey,
  makeVersionSeed,
  shuffleChoicesForQuestion
} from "../src/exam/versioning";

const baseQuestion = {
  uid: "latex:MAT3500:topic1:q1",
  subject: "discrete-math" as const,
  type: "mcq-single" as const,
  id: "topic1:q1",
  topic: "topic1",
  level: "basic" as const,
  number: 1,
  prompt: "Q1",
  choices: [
    { key: "A" as ChoiceKey, text: "a" },
    { key: "B" as ChoiceKey, text: "b" },
    { key: "C" as ChoiceKey, text: "c" },
    { key: "D" as ChoiceKey, text: "d" }
  ],
  answerKey: "C" as ChoiceKey
};

describe("versioning helpers", () => {
  it("builds identity key with priority to appUserId", () => {
    expect(getIdentityKey({ appUserId: "user-1", anonymousId: "anon" })).toBe("u:user-1");
    expect(getIdentityKey({ anonymousId: "anon-1" })).toBe("a:anon-1");
    expect(getIdentityKey({})).toBe("none");
  });

  it("computes deterministic version index within bounds", async () => {
    const idx = await computeVersionIndex("seed", "u:1", 2);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(2);
    const idxRepeat = await computeVersionIndex("seed", "u:1", 2);
    expect(idxRepeat).toBe(idx);
    const idxMax = await computeVersionIndex("seed", "u:1", 50);
    expect(idxMax).toBeGreaterThanOrEqual(0);
    expect(idxMax).toBeLessThan(50);
    const idxNoCount = await computeVersionIndex("seed", "u:1", undefined);
    expect(idxNoCount).toBeUndefined();
  });

  it("computes deterministic version ids", async () => {
    const id1 = await computeVersionId("exam", "seed", "u:1", 1);
    const id2 = await computeVersionId("exam", "seed", "u:1", 1);
    const id3 = await computeVersionId("exam", "seed", "u:2", 1);
    expect(id1).toHaveLength(12);
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
  });

  it("deterministically shuffles arrays", () => {
    const arr = [1, 2, 3, 4];
    const shuffled = deterministicShuffle(arr, "seed");
    const shuffled2 = deterministicShuffle(arr, "seed");
    expect(shuffled).toEqual(shuffled2);
    expect(shuffled).not.toEqual(arr);
  });

  it("shuffles choices per question deterministically and tracks correct key", () => {
    const versionSeed = makeVersionSeed("seed", "u:1", 0);
    const run1 = shuffleChoicesForQuestion(baseQuestion, versionSeed);
    const run2 = shuffleChoicesForQuestion(baseQuestion, versionSeed);
    expect(run1.choices).toEqual(run2.choices);
    expect(run1.displayedCorrectKey).toBe(run2.displayedCorrectKey);
    const correctChoice = run1.choices.find((c) => c.key === run1.displayedCorrectKey);
    expect(correctChoice?.text).toBe("c");
  });
});
