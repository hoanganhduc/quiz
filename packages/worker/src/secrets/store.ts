import type { Env } from "../env";
import { decryptString, encryptString, importKeyFromB64 } from "./crypto";

const NAME_RE = /^[a-zA-Z0-9-_]{1,60}$/;
const PREFIX = "secret:";

export type SecretRecordV1 = {
  name: string;
  createdAt: string;
  updatedAt: string;
  enc: { alg: "AES-GCM"; ivB64: string; ctB64: string };
};

function assertValidName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new Error("Invalid secret name");
  }
}

async function loadRecord(env: Env, name: string): Promise<SecretRecordV1 | null> {
  const raw = await env.QUIZ_KV.get(PREFIX + name);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as SecretRecordV1;
  return parsed;
}

async function getKey(env: Env): Promise<CryptoKey> {
  return importKeyFromB64(env.CONFIG_ENC_KEY_B64);
}

export async function listSecrets(env: Env): Promise<{ name: string; updatedAt: string }[]> {
  const listResp = await env.QUIZ_KV.list<{ name: string }>({ prefix: PREFIX });
  const items: { name: string; updatedAt: string }[] = [];
  for (const key of listResp.keys ?? []) {
    const name = key.name.replace(PREFIX, "");
    const record = await loadRecord(env, name);
    if (record) {
      items.push({ name: record.name, updatedAt: record.updatedAt });
    }
  }
  return items;
}

export async function putSecret(env: Env, name: string, plaintext: string): Promise<SecretRecordV1> {
  assertValidName(name);
  const key = await getKey(env);
  const now = new Date().toISOString();
  const existing = await loadRecord(env, name);
  const { ivB64, ctB64 } = await encryptString(key, plaintext);
  const record: SecretRecordV1 = {
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    enc: { alg: "AES-GCM", ivB64, ctB64 }
  };
  await env.QUIZ_KV.put(PREFIX + name, JSON.stringify(record));
  return record;
}

export async function deleteSecret(env: Env, name: string): Promise<void> {
  assertValidName(name);
  await env.QUIZ_KV.delete(PREFIX + name);
}

export async function getSecretPlaintext(env: Env, name: string): Promise<string | null> {
  assertValidName(name);
  const record = await loadRecord(env, name);
  if (!record) return null;
  const key = await getKey(env);
  return decryptString(key, record.enc.ivB64, record.enc.ctB64);
}
