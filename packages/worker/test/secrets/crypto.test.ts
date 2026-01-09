import { describe, expect, it } from "vitest";
import { webcrypto as nodeCrypto } from "crypto";
import { decryptString, encryptString, importKeyFromB64 } from "../../src/secrets/crypto";

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

describe("crypto helpers", () => {
  it("roundtrips encrypt/decrypt", async () => {
    const rawKey = nodeCrypto.getRandomValues(new Uint8Array(32));
    const key = await importKeyFromB64(toB64(rawKey));
    const plaintext = "hello secrets";
    const { ivB64, ctB64 } = await encryptString(key, plaintext);
    const result = await decryptString(key, ivB64, ctB64);
    expect(result).toBe(plaintext);
  });

  it("throws on invalid key size", async () => {
    await expect(importKeyFromB64("AA==")).rejects.toThrow();
  });
});
