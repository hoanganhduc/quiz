import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";

const TIMEZONE_KEY = "settings:timezone";

type TimezoneBody = { timezone?: string };

export function registerAdminSettingsRoutes(app: Hono<{ Bindings: Env }>) {
  app.put("/admin/settings/timezone", requireAdmin, async (c) => {
    let body: TimezoneBody = {};
    try {
      body = (await c.req.json()) as TimezoneBody;
    } catch {
      body = {};
    }
    const timezone = (body.timezone ?? "").trim();
    if (!timezone) {
      return c.text("timezone is required", 400);
    }
    await c.env.QUIZ_KV.put(TIMEZONE_KEY, timezone);
    return c.json({ ok: true, timezone });
  });
}
