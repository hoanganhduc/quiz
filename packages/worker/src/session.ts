import { SignJWT, jwtVerify } from "jose";
import { SessionV2Schema, type SessionV2 } from "@app/shared";
import { cookieSettingsForRequest } from "./cors";
import type { Env } from "./env";

const COOKIE_NAME = "quiz_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function getSecret(env: Env): Uint8Array {
  return encoder.encode(env.JWT_SECRET);
}

export async function signSession(env: Env, payload: SessionV2): Promise<string> {
  const parsed = SessionV2Schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Session payload failed validation");
  }
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(parsed.data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + MAX_AGE_SECONDS)
    .sign(getSecret(env));
}

export async function verifySession(env: Env, token: string): Promise<SessionV2 | null> {
  try {
    const result = await jwtVerify(token, getSecret(env));
    const parsed = SessionV2Schema.safeParse(result.payload);
    if (!parsed.success) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export async function issueSessionCookie(env: Env, request: Request, session: SessionV2): Promise<string> {
  const token = await signSession(env, session);
  return buildSessionCookie(request, token);
}

export function buildSessionCookie(request: Request, token: string): string {
  const { secure, sameSite } = cookieSettingsForRequest(request);
  const directives = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${MAX_AGE_SECONDS}`,
    `SameSite=${sameSite === "none" ? "None" : "Lax"}`
  ];
  if (secure) directives.push("Secure");
  return directives.join("; ");
}

export function buildClearSessionCookie(request: Request): string {
  const { secure, sameSite } = cookieSettingsForRequest(request);
  const directives = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    `SameSite=${sameSite === "none" ? "None" : "Lax"}`
  ];
  if (secure) directives.push("Secure");
  return directives.join("; ");
}

export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${COOKIE_NAME}=`)) {
      return cookie.slice(COOKIE_NAME.length + 1);
    }
  }
  return null;
}

export async function readSession(env: Env, request: Request): Promise<SessionV2 | null> {
  const cookie = readSessionCookie(request);
  if (cookie) return verifySession(env, cookie);

  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifySession(env, token);
  }

  return null;
}
