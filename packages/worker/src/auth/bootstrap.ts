import type { AppUser, SessionV2 } from "@app/shared";
import type { Env } from "../env";
import { putUser } from "../users/store";

export function providersFromUser(user: AppUser): SessionV2["providers"] {
  const providers: SessionV2["providers"] = [];
  if (user.linked.github) providers.push("github");
  if (user.linked.google) providers.push("google");
  return providers.length ? providers : ["anon"];
}

export async function ensureBootstrapAdmin(
  env: Env,
  user: AppUser,
  identity: { provider: "github" | "google"; username?: string; email?: string }
): Promise<AppUser> {
  const username = env.ADMIN_BOOTSTRAP_GITHUB_USERNAME;
  const email = env.ADMIN_BOOTSTRAP_EMAIL;
  if (!username && !email) return user;

  const usernameMatch =
    identity.provider === "github" &&
    username &&
    identity.username &&
    identity.username.toLowerCase() === username.toLowerCase();
  const emailMatch = email && identity.email && identity.email.toLowerCase() === email.toLowerCase();
  if (!usernameMatch && !emailMatch) return user;
  if (user.roles.includes("admin")) return user;

  const updated: AppUser = {
    ...user,
    roles: [...user.roles, "admin"],
    updatedAt: new Date().toISOString()
  };
  await putUser(env, updated);
  return updated;
}
