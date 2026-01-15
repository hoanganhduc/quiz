import { jwtVerify } from "jose";
import type { Hono } from "hono";
import type { Env } from "../env";
import type { AppUser, SessionV2 } from "@app/shared";
import { issueSessionCookie, readSession } from "../session";
import { getGoogleJwks } from "./jwksCache";
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

const VALID_ISS = new Set(["https://accounts.google.com", "accounts.google.com"]);

type GoogleIdPayload = {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  name?: string;
  email?: string;
};
type GoogleMode = "login" | "link";

class GoogleAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isAllowedRedirect(redirect: string, uiOrigin: string): boolean {
  return redirect.startsWith(uiOrigin) || isLocalUrl(redirect);
}

async function verifyGoogleIdToken(env: Env, idToken: string): Promise<GoogleIdPayload | null> {
  const jwks = getGoogleJwks();
  try {
    const result = await jwtVerify(idToken, jwks, {
      audience: env.GOOGLE_CLIENT_ID
    });
    return result.payload as GoogleIdPayload;
  } catch {
    return null;
  }
}

async function upsertGoogleUser(
  env: Env,
  payload: GoogleIdPayload,
  mode: GoogleMode,
  appUserId?: string
): Promise<{ user: AppUser; displayName: string }> {
  const providerUserId = payload.sub;
  const displayName = payload.name ?? "Google User";
  const linkedData = {
    sub: providerUserId,
    email: payload.email ?? undefined,
    name: payload.name ?? undefined
  };

  let user: AppUser;
  if (mode === "link") {
    if (!appUserId) {
      throw new GoogleAuthError(400, "Missing appUserId");
    }
    const found = await getUser(env, appUserId);
    if (!found) {
      throw new GoogleAuthError(404, "User record missing");
    }
    try {
      await linkProviderToUser(env, "google", providerUserId, appUserId);
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new GoogleAuthError(409, err.message);
      }
      throw err;
    }
    user = await updateLinkedProvider(env, found, "google", linkedData);
  } else {
    const mappedId = await getAppUserIdByProvider(env, "google", providerUserId);
    if (mappedId) {
      const found = await getUser(env, mappedId);
      if (!found) {
        throw new GoogleAuthError(500, "User record missing");
      }
      const nextProfile = {
        displayName: displayName ?? found.profile.displayName,
        email: payload.email ?? found.profile.email
      };
      user = {
        ...found,
        updatedAt: new Date().toISOString(),
        profile: nextProfile,
        linked: { ...found.linked, google: linkedData }
      };
      await putUser(env, user);
    } else {
      user = await createUserWithProvider(env, "google", providerUserId, linkedData, {
        displayName,
        email: payload.email ?? undefined
      });
    }
  }

  return { user, displayName };
}

function buildCallbackUrl(req: Request): string {
  const url = new URL(req.url);
  url.pathname = "/auth/callback/google";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function exchangeGoogleCode(env: Env, code: string, redirectUri: string): Promise<{ id_token?: string } | null> {
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!resp.ok) return null;
    return (await resp.json()) as { id_token?: string };
  } catch {
    return null;
  }
}

export function registerGoogleAuth(app: Hono<{ Bindings: Env }>) {
  app.get("/auth/google/start", async (c) => {
    const redirect = c.req.query("redirect");
    const modeParam = c.req.query("mode") ?? "login";
    const mode = (modeParam === "login" || modeParam === "link" ? modeParam : null) as GoogleMode | null;
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
    const kvKey = `oauth:google:${state}`;
    await c.env.QUIZ_KV.put(kvKey, JSON.stringify({ redirect, mode, appUserId }), { expirationTtl: 600 });

    const callbackUrl = buildCallbackUrl(c.req.raw);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");

    return c.redirect(url.toString());
  });

  app.get("/auth/callback/google", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state) {
      return c.text("Missing code or state", 400);
    }

    const kvKey = `oauth:google:${state}`;
    const stored = await c.env.QUIZ_KV.get(kvKey);
    await c.env.QUIZ_KV.delete(kvKey);
    if (!stored) {
      return c.text("Invalid state", 400);
    }

    let redirect: string | undefined;
    let mode: GoogleMode = "login";
    let appUserId: string | undefined;
    try {
      const parsed = JSON.parse(stored) as { redirect?: string; mode?: GoogleMode; appUserId?: string };
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

    const callbackUrl = buildCallbackUrl(c.req.raw);
    const tokens = await exchangeGoogleCode(c.env, code, callbackUrl);
    if (!tokens?.id_token) {
      return c.text("Failed to exchange code", 400);
    }

    const payload = await verifyGoogleIdToken(c.env, tokens.id_token);
    if (!payload || !VALID_ISS.has(payload.iss)) {
      return c.text("Invalid token", 401);
    }

    let user: AppUser;
    let displayName: string;
    try {
      ({ user, displayName } = await upsertGoogleUser(c.env, payload, mode, appUserId));
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        const status = err.status as 400 | 401 | 404 | 409 | 500;
        return c.text(err.message, status);
      }
      throw err;
    }

    user = await ensureBootstrapAdmin(c.env, user, {
      provider: "google",
      email: payload.email ?? undefined
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

  app.post("/auth/google", async (c) => {
    let idToken: string | undefined;
    let mode: GoogleMode = "login";
    try {
      const body = (await c.req.json()) as { idToken?: string; mode?: GoogleMode };
      idToken = body.idToken;
      if (body.mode === "link" || body.mode === "login") {
        mode = body.mode;
      }
    } catch {
      return c.text("Invalid body", 400);
    }

    if (!idToken) {
      return c.text("Missing idToken", 400);
    }

    const payload = await verifyGoogleIdToken(c.env, idToken);
    if (!payload) {
      return c.text("Invalid token", 401);
    }

    if (!VALID_ISS.has(payload.iss)) {
      return c.text("Invalid issuer", 401);
    }

    let linkAppUserId: string | undefined;
    if (mode === "link") {
      const session = await readSession(c.env, c.req.raw);
      if (!session) {
        return c.text("Unauthorized", 401);
      }
      linkAppUserId = session.appUserId;
    }

    let user: AppUser;
    let displayName: string;
    try {
      ({ user, displayName } = await upsertGoogleUser(c.env, payload, mode, linkAppUserId));
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        const status = err.status as 400 | 401 | 404 | 409 | 500;
        return c.text(err.message, status);
      }
      throw err;
    }

    user = await ensureBootstrapAdmin(c.env, user, {
      provider: "google",
      email: payload.email ?? undefined
    });

    const sessionPayload: SessionV2 = {
      appUserId: user.appUserId,
      roles: user.roles,
      providers: providersFromUser(user),
      displayName: user.profile.displayName ?? displayName
    };

    const cookie = await issueSessionCookie(c.env, c.req.raw, sessionPayload);

    const res = c.json({
      ok: true,
      user: {
        provider: "google",
        userId: user.appUserId,
        name: displayName,
        email: payload.email ?? undefined,
        ...sessionPayload
      }
    });
    res.headers.append("Set-Cookie", cookie);
    return res;
  });
}
