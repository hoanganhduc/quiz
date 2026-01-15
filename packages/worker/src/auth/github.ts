import type { Hono } from "hono";
import type { AppUser, SessionV2 } from "@app/shared";
import type { Env } from "../env";
import { issueSessionCookie, readSession } from "../session";
import {
  ConflictError,
  createUserWithProvider,
  getAppUserIdByProvider,
  getUser,
  linkProviderToUser,
  putUser,
  updateLinkedProvider
} from "../users/store";
import { ensureBootstrapAdmin, providersFromUser } from "./bootstrap";
import { isLocalUrl } from "../utils";

type GithubEmail = { email: string; primary?: boolean };
type GithubUser = { id: number; name?: string; login: string };
type GithubMode = "login" | "link";

function isAllowedRedirect(redirect: string, uiOrigin: string): boolean {
  return redirect.startsWith(uiOrigin) || isLocalUrl(redirect);
}

async function fetchGithubToken(env: Env, code: string, state: string): Promise<string | null> {
  const resp = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json" },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      state
    })
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as { access_token?: string };
  return data.access_token ?? null;
}

async function fetchGithubUser(token: string): Promise<{ user: GithubUser; email?: string } | null> {
  const commonHeaders = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "quiz-worker",
    Accept: "application/vnd.github+json"
  };

  const userResp = await fetch("https://api.github.com/user", { headers: commonHeaders });
  if (!userResp.ok) return null;
  const user = (await userResp.json()) as GithubUser;

  const emailResp = await fetch("https://api.github.com/user/emails", { headers: commonHeaders });
  if (!emailResp.ok) {
    return { user, email: undefined };
  }
  const emails = (await emailResp.json()) as GithubEmail[];
  const primary = emails.find((e) => e.primary)?.email ?? emails[0]?.email;

  return { user, email: primary };
}

export function registerGithubAuth(app: Hono<{ Bindings: Env }>) {
  app.get("/auth/github/start", async (c) => {
    const redirect = c.req.query("redirect");
    const modeParam = c.req.query("mode") ?? "login";
    const mode = (modeParam === "login" || modeParam === "link" ? modeParam : null) as GithubMode | null;
    if (!mode) {
      return c.text("Invalid mode", 400);
    }
    if (!redirect || !isAllowedRedirect(redirect, c.env.UI_ORIGIN)) {
      return c.text("Invalid redirect", 400);
    }

    let appUserId: string | undefined;
    if (mode === "link") {
      const session = await readSession(c.env, c.req.raw);
      if (!session) {
        return c.text("Unauthorized", 401);
      }
      appUserId = session.appUserId;
    }

    const state = crypto.randomUUID();
    const kvKey = `oauth:github:${state}`;
    await c.env.QUIZ_KV.put(kvKey, JSON.stringify({ redirect, mode, appUserId }), { expirationTtl: 600 });

    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "read:user user:email");

    return c.redirect(url.toString());
  });

  app.get("/auth/callback/github", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.text("Missing code or state", 400);
    }

    const kvKey = `oauth:github:${state}`;
    const stored = await c.env.QUIZ_KV.get(kvKey);
    await c.env.QUIZ_KV.delete(kvKey);
    if (!stored) {
      return c.text("Invalid state", 400);
    }

    let redirect: string | undefined;
    let mode: GithubMode = "login";
    let appUserId: string | undefined;
    try {
      const parsed = JSON.parse(stored) as { redirect?: string; mode?: GithubMode; appUserId?: string };
      redirect = parsed.redirect;
      if (parsed.mode === "login" || parsed.mode === "link") {
        mode = parsed.mode;
      }
      appUserId = parsed.appUserId;
    } catch {
      return c.text("Invalid state", 400);
    }

    if (!redirect || !isAllowedRedirect(redirect, c.env.UI_ORIGIN)) {
      return c.text("Invalid redirect", 400);
    }

    const token = await fetchGithubToken(c.env, code, state);
    if (!token) {
      return c.text("Failed to exchange code", 400);
    }

    const profile = await fetchGithubUser(token);
    if (!profile) {
      return c.text("Failed to fetch user", 400);
    }

    const providerUserId = String(profile.user.id);
    const displayName = profile.user.name ?? profile.user.login;
    const linkedData = {
      userId: providerUserId,
      username: profile.user.login,
      email: profile.email ?? undefined
    };

    let user: AppUser;
    if (mode === "link") {
      if (!appUserId) {
        return c.text("Missing appUserId", 400);
      }
      const found = await getUser(c.env, appUserId);
      if (!found) {
        return c.text("User record missing", 404);
      }
      try {
        await linkProviderToUser(c.env, "github", providerUserId, appUserId);
      } catch (err) {
        if (err instanceof ConflictError) {
          return c.text(err.message, 409);
        }
        throw err;
      }
      user = await updateLinkedProvider(c.env, found, "github", linkedData);
    } else {
      const mappedId = await getAppUserIdByProvider(c.env, "github", providerUserId);
      if (mappedId) {
        const found = await getUser(c.env, mappedId);
        if (!found) {
          return c.text("User record missing", 500);
        }
        const nextProfile = {
          displayName: displayName ?? found.profile.displayName,
          email: profile.email ?? found.profile.email
        };
        user = {
          ...found,
          updatedAt: new Date().toISOString(),
          profile: nextProfile,
          linked: { ...found.linked, github: linkedData }
        };
        await putUser(c.env, user);
      } else {
        user = await createUserWithProvider(c.env, "github", providerUserId, linkedData, {
          displayName,
          email: profile.email ?? undefined
        });
      }
    }

    user = await ensureBootstrapAdmin(c.env, user, {
      provider: "github",
      username: linkedData.username,
      email: linkedData.email
    });

    const sessionPayload: SessionV2 = {
      appUserId: user.appUserId,
      roles: user.roles,
      providers: providersFromUser(user),
      displayName: user.profile.displayName ?? displayName
    };

    const cookie = await issueSessionCookie(c.env, c.req.raw, sessionPayload);

    const res = c.redirect(redirect);
    res.headers.append("Set-Cookie", cookie);
    return res;
  });
}
