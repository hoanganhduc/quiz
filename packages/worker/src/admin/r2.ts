import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { buildWarnings, getMaxUploadBytes, getR2Usage, getUploadTtlSeconds, recordR2Usage } from "../r2/usage";

type UploadEvent = {
  key: string;
  bytes: number;
  mime?: string;
  scope: "sources" | "tools";
  sourceId?: string;
  expiresAt?: string;
  at: string;
};

const UPLOAD_PREFIX = "r2:upload:";

export function registerAdminR2Routes(app: Hono<{ Bindings: Env }>) {
  app.get("/admin/r2/usage", requireAdmin, async (c) => {
    const list = await c.env.QUIZ_KV.list({ prefix: UPLOAD_PREFIX, limit: 50 });
    const events: Array<UploadEvent & { kvKey: string }> = [];

    for (const key of list.keys) {
      const raw = await c.env.QUIZ_KV.get(key.name);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as UploadEvent;
        if (parsed?.key && parsed?.at) {
          events.push({ ...parsed, kvKey: key.name });
        }
      } catch {
        // ignore bad entry
      }
    }

    events.sort((a, b) => b.at.localeCompare(a.at));

    let deleted = 0;
    const now = Date.now();
    for (const event of events) {
      if (!event.expiresAt) continue;
      const expiresMs = Date.parse(event.expiresAt);
      if (!Number.isFinite(expiresMs) || now <= expiresMs) continue;
      await c.env.UPLOADS_BUCKET.delete(event.key);
      await c.env.QUIZ_KV.delete(event.kvKey);
      await recordR2Usage(c.env, { classA: 1, bytesStored: -(event.bytes ?? 0) });
      deleted += 1;
    }

    const refreshed = await getR2Usage(c.env);
    const visibleUploads = events.filter((event) => {
      if (!event.expiresAt) return true;
      const expiresMs = Date.parse(event.expiresAt);
      return !Number.isFinite(expiresMs) || now <= expiresMs;
    });
    return c.json({
      usage: refreshed,
      warnings: buildWarnings(refreshed),
      uploads: visibleUploads.slice(0, 15).map(({ kvKey, ...rest }) => rest),
      maxUploadBytes: getMaxUploadBytes(c.env),
      uploadTtlHours: Math.floor(getUploadTtlSeconds(c.env) / 3600),
      deleted
    });
  });
}
