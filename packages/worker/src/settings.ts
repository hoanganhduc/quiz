import type { Hono } from "hono";
import type { Env } from "./env";

const TIMEZONE_KEY = "settings:timezone";
const DEFAULT_TIMEZONE = "UTC";

export function registerSettingsRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/settings/timezone", async (c) => {
    const stored = await c.env.QUIZ_KV.get(TIMEZONE_KEY);
    const timezone = stored && stored.trim() ? stored : DEFAULT_TIMEZONE;
    return c.json({ timezone });
  });
}
