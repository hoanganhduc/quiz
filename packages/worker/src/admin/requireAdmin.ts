import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { readSession } from "../session";
import { getUser } from "../users/store";

export const requireAdmin: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const origin = c.req.header("Origin");
  let allowedOrigin = c.env.UI_ORIGIN;
  try {
    allowedOrigin = new URL(c.env.UI_ORIGIN).origin;
  } catch {
    // keep UI_ORIGIN as-is
  }

  if (origin && origin !== c.env.UI_ORIGIN && origin !== allowedOrigin) {
    return c.text("Forbidden", 403);
  }

  const auth = c.req.header("Authorization");
  if (auth && auth === `Bearer ${c.env.ADMIN_TOKEN}`) {
    await next();
    return;
  }

  const session = await readSession(c.env, c.req.raw);
  if (!session) {
    return c.text("Unauthorized (Missing Session)", 401);
  }

  const user = await getUser(c.env, session.appUserId);
  if (!user || !user.roles.includes("admin")) {
    return c.text("Forbidden", 403);
  }

  await next();
};
