import type { Hono } from "hono";
import type { Env } from "./env";
import { recordR2Usage } from "./r2/usage";

export function registerFilesRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/files/*", async (c) => {
    const key = decodeURIComponent(c.req.path.replace(/^\/files\//, ""));
    if (!key || key.includes("..")) {
      return c.text("Invalid key", 400);
    }

    const obj = await c.env.UPLOADS_BUCKET.get(key);
    if (!obj) {
      return c.text("Not found", 404);
    }

    const expiresAt = obj.customMetadata?.expiresAt;
    if (expiresAt) {
      const expiresMs = Date.parse(expiresAt);
      if (Number.isFinite(expiresMs) && Date.now() > expiresMs) {
        const logKey = obj.customMetadata?.logKey;
        await c.env.UPLOADS_BUCKET.delete(key);
        if (logKey) {
          await c.env.QUIZ_KV.delete(logKey);
        }
        await recordR2Usage(c.env, { classA: 1, bytesStored: -(obj.size ?? 0) });
        return c.text("Expired", 410);
      }
    }

    const size = obj.size ?? 0;
    await recordR2Usage(c.env, { classB: 1, bytesDownloaded: size });

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    return new Response(obj.body, { headers });
  });
}
