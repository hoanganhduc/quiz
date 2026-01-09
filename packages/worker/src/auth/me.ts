import type { Hono } from "hono";
import type { Env } from "../env";
import { buildClearSessionCookie, readSession } from "../session";
import { getUser } from "../users/store";

export function registerSessionRoutes(app: Hono<{ Bindings: Env }>) {
  app.post("/auth/logout", async (c) => {
    const cookie = buildClearSessionCookie(c.req.raw);
    const res = c.json({ ok: true });
    res.headers.append("Set-Cookie", cookie);
    return res;
  });

  app.get("/auth/me", async (c) => {
    const session = await readSession(c.env, c.req.raw);
    if (!session) {
      return c.json({ session: null });
    }

    const user = await getUser(c.env, session.appUserId);
    const roles = user?.roles ?? [];
    const displayName = user?.profile.displayName ?? session.displayName;

    const provider = session.providers.includes("github")
      ? "github"
      : session.providers.includes("google")
        ? "google"
        : "anon";

    return c.json({
      session: {
        ...session,
        roles,
        displayName,
        provider,
        userId: session.appUserId,
        anonymousId: provider === "anon" ? session.appUserId : undefined
      }
    });
  });
}
