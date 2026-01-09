const cryptoObj = globalThis.crypto;
if (!cryptoObj?.subtle || !cryptoObj.getRandomValues) {
  throw new Error("WebCrypto not available");
}
const subtle = cryptoObj.subtle;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function decodeB64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  if (typeof atob === "function") {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  throw new Error("No base64 decoder available");
}

function encodeB64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(view).toString("base64");
  }
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
    return btoa(binary);
  }
  throw new Error("No base64 encoder available");
}

export async function importKeyFromB64(b64: string): Promise<CryptoKey> {
  const raw = decodeB64(b64);
  if (raw.byteLength !== 32) {
    throw new Error("CONFIG_ENC_KEY_B64 must decode to 32 bytes");
  }
  return subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptString(
  key: CryptoKey,
  plaintext: string
): Promise<{ ivB64: string; ctB64: string }> {
  const iv = cryptoObj.getRandomValues(new Uint8Array(12));
  const encoded = textEncoder.encode(plaintext);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { ivB64: encodeB64(iv), ctB64: encodeB64(ct) };
}

export async function decryptString(key: CryptoKey, ivB64: string, ctB64: string): Promise<string> {
  const iv = decodeB64(ivB64);
  const ct = decodeB64(ctB64);
  const ptBuf = await subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return textDecoder.decode(ptBuf);
}
