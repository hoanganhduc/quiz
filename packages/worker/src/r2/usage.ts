import type { Env } from "../env";

export type R2Usage = {
  month: string;
  classA: number;
  classB: number;
  bytesUploaded: number;
  bytesDownloaded: number;
  bytesStored: number;
  updatedAt: string;
};

export type R2UsageDelta = Partial<Pick<R2Usage, "classA" | "classB" | "bytesUploaded" | "bytesDownloaded" | "bytesStored">>;

export type R2UsageSummary = {
  usage: R2Usage;
  warnings: string[];
};

const USAGE_PREFIX = "r2:usage:";
const UPLOAD_LOG_PREFIX = "r2:upload:";
const FREE_TIER = {
  storageBytes: 10 * 1024 * 1024 * 1024,
  classA: 1_000_000,
  classB: 10_000_000
};
const WARN_THRESHOLD = 0.5;

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function getR2Usage(env: Env, date = new Date()): Promise<R2Usage> {
  const month = monthKey(date);
  const raw = await env.QUIZ_KV.get(USAGE_PREFIX + month);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as R2Usage;
      if (parsed?.month === month) {
        return parsed;
      }
    } catch {
      // ignore parse failure
    }
  }
  return {
    month,
    classA: 0,
    classB: 0,
    bytesUploaded: 0,
    bytesDownloaded: 0,
    bytesStored: 0,
    updatedAt: new Date().toISOString()
  };
}

export async function recordR2Usage(env: Env, delta: R2UsageDelta): Promise<R2UsageSummary> {
  const current = await getR2Usage(env);
  const next: R2Usage = {
    ...current,
    classA: current.classA + (delta.classA ?? 0),
    classB: current.classB + (delta.classB ?? 0),
    bytesUploaded: current.bytesUploaded + (delta.bytesUploaded ?? 0),
    bytesDownloaded: current.bytesDownloaded + (delta.bytesDownloaded ?? 0),
    bytesStored: current.bytesStored + (delta.bytesStored ?? 0),
    updatedAt: new Date().toISOString()
  };
  next.bytesStored = Math.max(0, next.bytesStored);
  await env.QUIZ_KV.put(USAGE_PREFIX + next.month, JSON.stringify(next));
  return { usage: next, warnings: buildWarnings(next) };
}

export async function recordUploadEvent(
  env: Env,
  data: { key: string; bytes: number; mime?: string; scope: "sources" | "tools"; sourceId?: string; expiresAt?: string }
): Promise<string> {
  const payload = {
    ...data,
    at: new Date().toISOString()
  };
  const key = `${UPLOAD_LOG_PREFIX}${Date.now()}:${crypto.randomUUID()}`;
  await env.QUIZ_KV.put(key, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 30 });
  return key;
}

export function buildWarnings(usage: R2Usage): string[] {
  const warnings: string[] = [];
  if (usage.classA >= FREE_TIER.classA * WARN_THRESHOLD) {
    warnings.push(`R2 Class A operations reached ${Math.round((usage.classA / FREE_TIER.classA) * 100)}% of free tier.`);
  }
  if (usage.classB >= FREE_TIER.classB * WARN_THRESHOLD) {
    warnings.push(`R2 Class B operations reached ${Math.round((usage.classB / FREE_TIER.classB) * 100)}% of free tier.`);
  }
  if (usage.bytesStored >= FREE_TIER.storageBytes * WARN_THRESHOLD) {
    warnings.push(`Approximate R2 stored bytes reached ${Math.round((usage.bytesStored / FREE_TIER.storageBytes) * 100)}% of free tier.`);
  }
  return warnings;
}

export function getUploadTtlSeconds(env: Env): number {
  const raw = env.UPLOAD_TTL_HOURS;
  const parsed = raw ? Number(raw) : NaN;
  const hours = Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
  return Math.floor(hours * 60 * 60);
}

export function getMaxUploadBytes(env: Env): number {
  const raw = env.UPLOAD_MAX_BYTES;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 100 * 1024 * 1024;
}

export function buildR2PublicUrl(env: Env, key: string, fallbackOrigin?: string): string {
  const base = env.R2_PUBLIC_URL?.trim();
  const root = base && base.length > 0 ? base.replace(/\/$/, "") : fallbackOrigin ? `${fallbackOrigin}/files` : "";
  return root ? `${root}/${key}` : key;
}
