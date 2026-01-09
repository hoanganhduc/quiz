import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { Buffer } from "node:buffer";
import { getSecretPlaintext } from "../secrets/store";
import { buildLatexQuestions, importCanvasZipBytes, parseLatexQuestions, exportCanvasZip } from "@app/shared/importers";
import { buildR2PublicUrl, getMaxUploadBytes, getUploadTtlSeconds, recordR2Usage, recordUploadEvent } from "../r2/usage";

type ToolSource =
  | { type: "direct"; url: string; auth?: { kind: "httpHeader"; secretRef: string } }
  | { type: "github"; repo: string; branch: string; path: string; auth?: { kind: "githubToken"; secretRef: string } }
  | { type: "gdrive"; fileId: string; auth?: { kind: "httpHeader"; secretRef: string } };

type CanvasToLatexRequest = {
  source: ToolSource;
  courseCode?: string;
  subject?: string;
  level?: string;
  versionIndex?: number;
  topicByQuizTitle?: Record<string, string>;
};

type LatexToCanvasRequest = {
  source: ToolSource;
  quizTitle: string;
  topic: string;
  courseCode?: string;
  subject?: string;
  level?: string;
  versionIndex?: number;
  fillBlankExportMode?: "combined_short_answer" | "split_items";
  combinedDelimiter?: string;
};

function parseHeaderLine(headerLine: string): { name: string; value: string } {
  const idx = headerLine.indexOf(":");
  if (idx <= 0) {
    throw new Error("Invalid auth header secret (expected 'Header: value').");
  }
  const name = headerLine.slice(0, idx).trim();
  const value = headerLine.slice(idx + 1).trim();
  if (!name || !value) {
    throw new Error("Invalid auth header secret (expected 'Header: value').");
  }
  return { name, value };
}

async function resolveAuthHeaders(env: Env, auth?: ToolSource["auth"]): Promise<Headers> {
  const headers = new Headers();
  if (!auth) return headers;

  const secret = await getSecretPlaintext(env, auth.secretRef);
  if (!secret) {
    throw new Error(`Secret not found for ref: ${auth.secretRef}`);
  }

  if (auth.kind === "githubToken") {
    headers.set("Authorization", `Bearer ${secret}`);
    return headers;
  }

  const { name, value } = parseHeaderLine(secret);
  headers.set(name, value);
  return headers;
}

function assertHttps(url: string) {
  if (!url.startsWith("https://")) {
    throw new Error("Direct link must start with https://");
  }
}

async function fetchToolResponse(env: Env, source: ToolSource): Promise<{ res: Response; warnings: string[] }> {
  const warnings: string[] = [];
  let url = "";
  let headers = new Headers();

  if (source.type === "direct") {
    const directUrl = source.url?.trim?.() ?? "";
    if (!directUrl) throw new Error("Missing direct url");
    assertHttps(directUrl);
    url = directUrl;
    headers = await resolveAuthHeaders(env, source.auth);
  } else if (source.type === "github") {
    const repo = source.repo?.trim?.() ?? "";
    const branch = source.branch?.trim?.() ?? "";
    const path = (source.path ?? "").trim().replace(/^\/+/, "");
    if (!repo || !branch || !path) throw new Error("Missing repo, branch, or path");
    url = `https://raw.githubusercontent.com/${repo}/${branch}/${path}`;
    headers = await resolveAuthHeaders(env, source.auth);
  } else if (source.type === "gdrive") {
    const fileId = source.fileId?.trim?.() ?? "";
    if (!fileId) throw new Error("Missing Google Drive fileId");
    if (source.auth) {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      headers = await resolveAuthHeaders(env, source.auth);
    } else {
      url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      warnings.push("Google Drive fetch without auth may fail unless the file is shared publicly.");
    }
  } else {
    throw new Error("Unsupported source type");
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status})`);
  }
  return { res, warnings };
}

export function registerAdminToolsRoutes(app: Hono<{ Bindings: Env }>) {
  app.post("/admin/tools/canvas-to-latex", requireAdmin, async (c) => {
    let body: CanvasToLatexRequest;
    try {
      body = (await c.req.json()) as CanvasToLatexRequest;
    } catch {
      return c.text("Invalid JSON", 400);
    }

    if (!body?.source) {
      return c.text("Missing source", 400);
    }

    const courseCode = body.courseCode?.trim?.() || "MAT3500";
    const subject = body.subject?.trim?.() || "discrete-math";
    const level = body.level?.trim?.() || "basic";
    const versionIndex = Number.isFinite(Number(body.versionIndex)) ? Number(body.versionIndex) : undefined;
    const topicByQuizTitle =
      body.topicByQuizTitle && typeof body.topicByQuizTitle === "object"
        ? body.topicByQuizTitle
        : undefined;

    const { res, warnings: fetchWarnings } = await fetchToolResponse(c.env, body.source);
    const bytes = Buffer.from(await res.arrayBuffer());
    const result = await importCanvasZipBytes(bytes, {
      courseCode,
      subject,
      level,
      versionIndex,
      topicByQuizTitle
    });
    const warnings = [...fetchWarnings, ...result.warnings];

    const latexByQuizVersionId: Record<string, string> = {};
    for (const quiz of result.quizzes) {
      latexByQuizVersionId[quiz.version.versionId] = buildLatexQuestions(quiz, result.answerKey, {
        courseCode,
        subject,
        level,
        versionIndex,
        includeSolutions: true
      });
    }

    return c.json({
      latexByQuizVersionId,
      answerKey: result.answerKey,
      warnings
    });
  });

  app.post("/admin/tools/latex-to-canvas", requireAdmin, async (c) => {
    let body: LatexToCanvasRequest;
    try {
      body = (await c.req.json()) as LatexToCanvasRequest;
    } catch {
      return c.text("Invalid JSON", 400);
    }

    if (!body?.source) {
      return c.text("Missing source", 400);
    }

    const quizTitle = body.quizTitle?.trim?.();
    const topic = body.topic?.trim?.();
    if (!quizTitle || !topic) {
      return c.text("Missing quizTitle or topic", 400);
    }

    const courseCode = body.courseCode?.trim?.() || "MAT3500";
    const subject = body.subject?.trim?.() || "discrete-math";
    const level = body.level?.trim?.() || "basic";
    const versionIndex = Number.isFinite(Number(body.versionIndex)) ? Number(body.versionIndex) : undefined;
    const fillBlankExportMode = body.fillBlankExportMode as "combined_short_answer" | "split_items" | undefined;
    const combinedDelimiter = body.combinedDelimiter?.trim?.() || "; ";

    const { res, warnings: fetchWarnings } = await fetchToolResponse(c.env, body.source);
    const texText = await res.text();
    if (!texText.trim()) {
      return c.text("Missing LaTeX content", 400);
    }

    const parsed = await parseLatexQuestions(texText, { courseCode, subject, level, versionIndex, topic });
    const quiz = {
      version: { versionId: quizTitle, versionIndex: versionIndex ?? 0 },
      questions: parsed.quiz.questions
    };

    const zipBytes = await exportCanvasZip([quiz], parsed.answerKey, [], {
      courseCode,
      subject,
      level,
      versionIndex,
      fillBlankExportMode,
      combinedDelimiter
    });

    return c.json({
      zipBase64: Buffer.from(zipBytes).toString("base64"),
      answerKey: parsed.answerKey,
      warnings: [...fetchWarnings, ...parsed.warnings]
    });
  });

  app.post("/admin/tools/upload", requireAdmin, async (c) => {
    const form = await c.req.raw.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.text("Missing file", 400);
    }
    const maxBytes = getMaxUploadBytes(c.env);
    if (file.size > maxBytes) {
      return c.text(`File exceeds ${maxBytes} bytes`, 413);
    }

    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_") || "upload.bin";
    const key = `tools/${Date.now()}-${crypto.randomUUID()}/${safeName}`;
    const ttlSeconds = getUploadTtlSeconds(c.env);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const bytes = new Uint8Array(await file.arrayBuffer());

    const logKey = await recordUploadEvent(c.env, { key, bytes: bytes.byteLength, mime: file.type, scope: "tools", expiresAt });

    try {
      await c.env.UPLOADS_BUCKET.put(key, bytes, {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
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
