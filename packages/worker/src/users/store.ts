import { AppUserSchema, type AppUser } from "@app/shared";
import type { Env } from "../env";

const userKey = (appUserId: string) => `user:${appUserId}`;
const identKey = (provider: Provider, providerUserId: string) => `ident:${provider}:${providerUserId}`;

const AppUserIdSchema = AppUserSchema.shape.appUserId;

type Provider = "github" | "google";

type ProviderLinkedData =
  | { provider: "github"; data: NonNullable<AppUser["linked"]["github"]> }
  | { provider: "google"; data: NonNullable<AppUser["linked"]["google"]> };

export class ConflictError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export async function getUser(env: Env, appUserId: string): Promise<AppUser | null> {
  const raw = await env.QUIZ_KV.get(userKey(appUserId));
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("User record is not valid JSON");
  }
  const parsed = AppUserSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("User record failed validation");
  }
  return parsed.data;
}

export async function putUser(env: Env, user: AppUser): Promise<void> {
  const parsed = AppUserSchema.safeParse(user);
  if (!parsed.success) {
    throw new Error("User record failed validation");
  }
  await env.QUIZ_KV.put(userKey(parsed.data.appUserId), JSON.stringify(parsed.data));
}

export async function getAppUserIdByProvider(
  env: Env,
  provider: Provider,
  providerUserId: string
): Promise<string | null> {
  const raw = await env.QUIZ_KV.get(identKey(provider, providerUserId));
  if (!raw) return null;
  const parsed = AppUserIdSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Provider identity mapping failed validation");
  }
  return parsed.data;
}

export async function linkProviderToUser(
  env: Env,
  provider: Provider,
  providerUserId: string,
  appUserId: string
): Promise<void> {
  const existing = await getAppUserIdByProvider(env, provider, providerUserId);
  if (existing && existing !== appUserId) {
    throw new ConflictError("Provider identity already linked to another user");
  }
  const parsed = AppUserIdSchema.safeParse(appUserId);
  if (!parsed.success) {
    throw new Error("appUserId failed validation");
  }
  await env.QUIZ_KV.put(identKey(provider, providerUserId), parsed.data);
}

export async function createUserWithProvider(
  env: Env,
  provider: Provider,
  providerUserId: string,
  linkedData: ProviderLinkedData["data"],
  profilePartial: Partial<AppUser["profile"]> = {}
): Promise<AppUser> {
  const existing = await getAppUserIdByProvider(env, provider, providerUserId);
  if (existing) {
    throw new ConflictError("Provider identity already linked to another user");
  }

  const now = new Date().toISOString();
  const linked =
    provider === "github"
      ? { github: linkedData as AppUser["linked"]["github"] }
      : { google: linkedData as AppUser["linked"]["google"] };
  const user: AppUser = {
    appUserId: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    roles: [],
    profile: {
      displayName: profilePartial.displayName,
      email: profilePartial.email
    },
    linked
  };

  await putUser(env, user);
  await linkProviderToUser(env, provider, providerUserId, user.appUserId);
  return user;
}

export async function updateLinkedProvider(
  env: Env,
  user: AppUser,
  provider: Provider,
  linkedData: ProviderLinkedData["data"]
): Promise<AppUser> {
  const updated: AppUser = {
    ...user,
    updatedAt: new Date().toISOString(),
    linked: {
      ...user.linked,
      ...(provider === "github"
        ? { github: linkedData as AppUser["linked"]["github"] }
        : { google: linkedData as AppUser["linked"]["google"] })
    }
  };
  await putUser(env, updated);
  return updated;
}
