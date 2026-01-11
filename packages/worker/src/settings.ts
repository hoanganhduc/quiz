import type { Hono } from "hono";
import type { Env } from "./env";

const TIMEZONE_KEY = "settings:timezone";
const TIME_FORMAT_KEY = "settings:timeformat";
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_TIME_FORMAT = "ddmmyyyy";

export function registerSettingsRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/settings/timezone", async (c) => {
    const stored = await c.env.QUIZ_KV.get(TIMEZONE_KEY);
    const timezone = stored && stored.trim() ? stored : DEFAULT_TIMEZONE;
    return c.json({ timezone });
  });
  app.get("/settings/timeformat", async (c) => {
    const stored = await c.env.QUIZ_KV.get(TIME_FORMAT_KEY);
    const format = stored && stored.trim() ? stored : DEFAULT_TIME_FORMAT;
    return c.json({ format });
  });
}
