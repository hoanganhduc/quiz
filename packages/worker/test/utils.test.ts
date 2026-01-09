import { describe, expect, it } from "vitest";
import { createRng, hashAccessCode, sampleN, sha256Hex, shuffle } from "../src/utils.js";

describe("sha256 helpers", () => {
  it("hashes text deterministically", async () => {
    const result = await sha256Hex("hello");
    expect(result).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("hashes access codes with salt", async () => {
    const result = await hashAccessCode("code123", "examA", "pepper");
    expect(result).toBe("ba14a1796ee4bb0c0da62573148b7a2d9714b43f9d972be578db08927a5a6171");
  });
});

describe("deterministic rng", () => {
  it("produces deterministic sequences for same seed", () => {
    const rng1 = createRng("seed-value");
    const rng2 = createRng("seed-value");
    const seq1 = [rng1(), rng1(), rng1(), rng1()];
    const seq2 = [rng2(), rng2(), rng2(), rng2()];
    expect(seq1).toEqual(seq2);
  });

  it("shuffles deterministically", () => {
    const rng = createRng("shuffle-seed");
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr, rng);
    expect(result).toEqual([5, 4, 2, 1, 3]);
    expect(arr).toEqual([1, 2, 3, 4, 5]); // original untouched
  });

  it("samples without replacement deterministically", () => {
    const rng = createRng("sample-seed");
    const arr = ["a", "b", "c", "d", "e"];
    const result = sampleN(arr, 3, rng);
    expect(result).toEqual(["b", "e", "c"]);
  });
});
