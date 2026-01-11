import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { getLatestBanks } from "../kv";

const BANK_PREFIX = "banks:";
const BANK_SUBJECT_PREFIX = /^banks:([^:]+):/;

export function registerAdminBanksRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/admin/banks", requireAdmin, async (c) => {
    const subjects = new Set<string>();
    let cursor: string | undefined;

    do {
      const res = await c.env.QUIZ_KV.list({ prefix: BANK_PREFIX, cursor, limit: 1000 });
      for (const key of res.keys) {
        const match = /^banks:([^:]+):latest:public$/.exec(key.name);
        if (match) {
          subjects.add(match[1]);
        }
      }
      cursor = res.list_complete ? undefined : res.cursor;
    } while (cursor);

    return c.json({ subjects: Array.from(subjects).sort() });
  });

  app.get("/admin/banks/:subject/public", requireAdmin, async (c) => {
    const subject = c.req.param("subject");
    if (!subject) {
      return c.text("Missing subject", 400);
    }
    const banks = await getLatestBanks(c.env, subject);
    if (!banks.ok) {
      const status = banks.status as 400 | 404 | 500;
      return c.text(banks.error, status);
    }
    return c.json(banks.value.publicBank);
  });

  app.post("/admin/banks/clear", requireAdmin, async (c) => {
    let body: { subject?: string } = {};
    try {
      body = (await c.req.json()) as { subject?: string };
    } catch {
      body = {};
    }

    let deleted = 0;
    let cursor: string | undefined;
    const prefix = body.subject ? `${BANK_PREFIX}${body.subject}:` : BANK_PREFIX;

    do {
      const res = await c.env.QUIZ_KV.list({ prefix, cursor, limit: 1000 });
      for (const key of res.keys) {
        await c.env.QUIZ_KV.delete(key.name);
        deleted += 1;
      }
      cursor = res.list_complete ? undefined : res.cursor;
    } while (cursor);

    if (!body.subject && deleted === 0) {
      // ensure we delete any fallback keys even if no list entry
      const all = await c.env.QUIZ_KV.list({ prefix: BANK_PREFIX, limit: 1000 });
      for (const key of all.keys) {
        await c.env.QUIZ_KV.delete(key.name);
        deleted += 1;
      }
    }

    return c.json({ ok: true, deleted });
  });
}
