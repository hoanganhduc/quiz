import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { getSourcesConfig, putSourcesConfig } from "../sources/store";
import type { SourcesConfigV1 } from "@app/shared";
import { resolveForBuild, type ResolvedSourcesConfigV1 } from "../sources/resolve";
import { buildR2PublicUrl, getMaxUploadBytes, getUploadTtlSeconds, recordR2Usage, recordUploadEvent } from "../r2/usage";

export function registerAdminSourcesRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/admin/sources", requireAdmin, async (c) => {
    const cfg = await getSourcesConfig(c.env);
    return c.json(cfg);
  });

  app.put("/admin/sources", requireAdmin, async (c) => {
    let body: SourcesConfigV1;
    try {
      body = (await c.req.json()) as SourcesConfigV1;
    } catch {
      return c.text("Invalid body", 400);
    }

    try {
      const stored = await putSourcesConfig(c.env, body);
      return c.json(stored);
    } catch (err: any) {
      return c.text(err?.message ?? "Invalid config", 400);
    }
  });

  app.get("/admin/sources/export", requireAdmin, async (c) => {
    try {
      const cfg = await getSourcesConfig(c.env);
      const resolved = await resolveForBuild(c.env, cfg);
      return c.json({ generatedAt: new Date().toISOString(), config: resolved });
    } catch (err: any) {
      return c.text(err?.message ?? "Failed to export sources", 400);
    }
  });

  app.post("/admin/sources/test", requireAdmin, async (c) => {
    let body: { sourceId?: string };
    try {
      body = (await c.req.json()) as { sourceId?: string };
    } catch {
      return c.text("Invalid body", 400);
    }

    if (!body.sourceId) {
      return c.text("Missing sourceId", 400);
    }

    const cfg = await getSourcesConfig(c.env);
    const resolved = await resolveForBuild(c.env, cfg);
    const source = resolved.sources.find((s) => s.id === body.sourceId);
    if (!source) {
      return c.text("Source not found", 404);
    }

    const resolvedSource = source as ResolvedSourcesConfigV1["sources"][number];
    let url: string;
    let init: RequestInit = { headers: {} };

    const headers = new Headers();

    if (resolvedSource.type === "github") {
      url = `https://api.github.com/repos/${resolvedSource.repo}/zipball/${resolvedSource.branch}`;
      init.method = "HEAD";
      if (resolvedSource.resolvedAuth) {
        headers.set("Authorization", resolvedSource.resolvedAuth.authorizationBearer);
      }
      headers.set("Accept", "application/vnd.github+json");
      headers.set("User-Agent", "quiz-worker");
    } else if (resolvedSource.type === "gdrive") {
      const u = new URL("https://www.googleapis.com/drive/v3/files");
      u.searchParams.set("q", `'${(resolvedSource as any).folderId}' in parents and trashed=false`);
      u.searchParams.set("fields", "files(id)");
      u.searchParams.set("pageSize", "1");
      u.searchParams.set("supportsAllDrives", "true");
      u.searchParams.set("includeItemsFromAllDrives", "true");
      url = u.toString();
      init.method = "GET";
      if (resolvedSource.resolvedAuth) {
        const parts = resolvedSource.resolvedAuth.headerLine.split(":");
        const name = parts.shift()?.trim();
        const value = parts.join(":").trim();
        if (!name || !value) {
          return c.text("Invalid headerLine", 400);
        }
        headers.set(name, value);
      }
    } else if (resolvedSource.type === "zip" || resolvedSource.type === "canvas") {
      url = resolvedSource.url;
      init.method = "GET";
      headers.set("Range", "bytes=0-0");
      if (resolvedSource.resolvedAuth) {
        const parts = resolvedSource.resolvedAuth.headerLine.split(":");
        const name = parts.shift()?.trim();
        const value = parts.join(":").trim();
        if (!name || !value) {
          return c.text("Invalid headerLine", 400);
        }
        headers.set(name, value);
      }
    } else {
      return c.text("Unsupported source type", 400);
    }

    init.headers = headers;

    try {
      const res = await fetch(url, init);
      const payload = { ok: res.ok, status: res.status };
      if (!res.ok) {
        return c.json({ ok: false, status: res.status, message: "Fetch failed" }, 502);
      }
      return c.json(payload);
    } catch {
      return c.json({ ok: false, status: 0, message: "Fetch failed" }, 502);
    }
  });

  app.post("/admin/sources/upload", requireAdmin, async (c) => {
    const form = await c.req.raw.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.text("Missing file", 400);
    }
    const maxBytes = getMaxUploadBytes(c.env);
    if (file.size > maxBytes) {
      return c.text(`File exceeds ${maxBytes} bytes`, 413);
    }

    const sourceId = typeof form.get("sourceId") === "string" ? String(form.get("sourceId")).trim() : "";
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_") || "source.zip";
    const prefix = sourceId ? `sources/${sourceId}` : "sources";
    const key = `${prefix}/${Date.now()}-${crypto.randomUUID()}/${safeName}`;
    const ttlSeconds = getUploadTtlSeconds(c.env);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const logKey = await recordUploadEvent(c.env, {
      key,
      bytes: bytes.byteLength,
      mime: file.type,
      scope: "sources",
      sourceId: sourceId || undefined,
      expiresAt
    });

    try {
      await c.env.UPLOADS_BUCKET.put(key, bytes, {
        httpMetadata: { contentType: file.type || "application/zip" },
        customMetadata: { expiresAt, logKey }
      });
    } catch {
      await c.env.QUIZ_KV.delete(logKey);
      throw new Error("Upload failed");
    }

    const usageSummary = await recordR2Usage(c.env, {
      classA: 1,
      bytesUploaded: bytes.byteLength,
      bytesStored: bytes.byteLength
    });

    const url = buildR2PublicUrl(c.env, key, new URL(c.req.url).origin);
    return c.json({
      url,
      key,
      size: bytes.byteLength,
      expiresAt,
      warnings: usageSummary.warnings,
      usage: usageSummary.usage
    });
  });

}
