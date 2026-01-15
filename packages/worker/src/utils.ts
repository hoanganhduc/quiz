const cryptoImpl: Crypto = globalThis.crypto as Crypto;

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await cryptoImpl.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashAccessCode(code: string, examId: string, pepper: string): Promise<string> {
  return sha256Hex(`${code}:${examId}:${pepper}`);
}

// Deterministic RNG (xmur3 + mulberry32)
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): () => number {
  const seedFn = xmur3(seed);
  const rng = mulberry32(seedFn());
  return rng;
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function sampleN<T>(arr: T[], n: number, rng: () => number): T[] {
  if (n > arr.length) {
    throw new Error("sample size exceeds array length");
  }
  const shuffled = shuffle(arr, rng);
  return shuffled.slice(0, n);
}

export function isLocalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname;
    // Localhost
    if (host === "localhost" || host === "127.0.0.1") return true;
    // Private IP ranges
    // 10.0.0.0 - 10.255.255.255
    if (host.startsWith("10.")) return true;
    // 172.16.0.0 - 172.31.255.255
    if (host.startsWith("172.")) {
      const parts = host.split(".");
      if (parts.length >= 2) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) return true;
      }
    }
    // 192.168.0.0 - 192.168.255.255
    if (host.startsWith("192.168.")) return true;
    return false;
  } catch {
    return false;
  }
}
