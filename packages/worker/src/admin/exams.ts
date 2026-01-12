import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { getExam, getLatestBanks, putExam } from "../kv";
import { createRng, hashAccessCode, shuffle } from "../utils";
import {
  ExamV1Schema,
  getSubtopicIdsForCategory,
  isTopicCategory,
  normalizeExamVisibility,
  normalizeExamPolicyDefaults,
  type BankPublicV1,
  type ExamCompositionItemV1,
  type ExamCompositionLevel,
  type ExamVisibility,
  type ExamPolicyV1,
  type ExamV1,
  type QuestionLevel
} from "@app/shared";

type AdminExamBody = {
  subject: "discrete-math";
  composition: ExamCompositionItemV1[];
  title?: string;
  seed?: string;
  policy: ExamPolicyV1;
  codes?: string[];
  expiresAt?: string | null;
  visibility?: ExamVisibility;
};

type ExamTemplateBody = {
  name: string;
  template: {
    subject: "discrete-math";
    composition: ExamCompositionItemV1[];
    policy: ExamPolicyV1;
    codes?: string[];
    expiresAt?: string | null;
  };
};

const EXAM_PREFIX = "exam:";
const TEMPLATE_PREFIX = "examTemplate:";
const SHORT_PREFIX = "short:";
const SHORT_EXAM_PREFIX = "shortExam:";

function randomShortCode(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) {
    out += alphabet[b % alphabet.length];
  }
  return out;
}

function parseLimit(value: string | null | undefined, fallback = 50) {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return Date.now() > Date.parse(expiresAt);
}

function isDeleted(deletedAt?: string): boolean {
  if (!deletedAt) return false;
  return Date.now() >= Date.parse(deletedAt);
}

function getExpiryTtlSeconds(expiresAt?: string): number | undefined {
  if (!expiresAt) return undefined;
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.ceil(ms / 1000);
}

async function hasSubmissions(env: Env, examId: string): Promise<boolean> {
  const list = await env.QUIZ_KV.list({ prefix: `sub:${examId}:`, limit: 1 });
  return list.keys.length > 0;
}

function selectQuestions(composition: AdminExamBody["composition"], bank: BankPublicV1, seed: string): string[] {
  const rng = createRng(seed);
  const chosen = new Set<string>();
  const results: string[] = [];
  for (const item of composition) {
    const allowedTopics = isTopicCategory(item.topic) ? getSubtopicIdsForCategory(item.topic) : [item.topic];
    const levelMatches = (level: ExamCompositionLevel, questionLevel: QuestionLevel) =>
      level === "none" ? true : questionLevel === level;
    const pool = bank.questions.filter(
      (q) => allowedTopics.includes(q.topic) && levelMatches(item.level, q.level) && !chosen.has(q.uid)
    );
    const ordered = shuffle(pool, rng);
    if (ordered.length < item.n) {
      throw new Error(`Not enough questions for ${item.topic}/${item.level}`);
    }
    for (let i = 0; i < item.n; i += 1) {
      const q = ordered[i];
      chosen.add(q.uid);
      results.push(q.uid);
    }
  }
  return results;
}

function parseTemplateBody(body: any): ExamTemplateBody {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid body");
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new Error("Template name is required");
  const template = body.template;
  if (!template || typeof template !== "object") throw new Error("Template is required");
  if (template.subject !== "discrete-math") throw new Error("Unsupported subject");
  if (!Array.isArray(template.composition) || template.composition.length === 0) {
    throw new Error("Composition is required");
  }
  if (!template.policy || typeof template.policy !== "object") {
    throw new Error("Policy is required");
  }
  if (template.codes !== undefined && !Array.isArray(template.codes)) {
    throw new Error("codes must be an array");
  }
    if (Array.isArray(template.codes) && template.codes.some((code: unknown) => typeof code !== "string")) {
    throw new Error("codes must be strings");
  }
  return { name, template };
}

export function registerAdminExamRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/admin/exams", requireAdmin, async (c) => {
    const limit = parseLimit(c.req.query("limit"));
    const cursor = c.req.query("cursor") ?? undefined;
    const includeDeleted = c.req.query("includeDeleted") === "1";
    const list = await c.env.QUIZ_KV.list({ prefix: EXAM_PREFIX, limit, cursor });
    const items = [];
    for (const key of list.keys) {
      const raw = await c.env.QUIZ_KV.get(key.name);
      if (!raw) continue;
      let exam: ExamV1;
      try {
        exam = JSON.parse(raw) as ExamV1;
      } catch {
        continue;
      }
      if (!includeDeleted && exam.deletedAt) continue;
      const taken = await hasSubmissions(c.env, exam.examId);
      items.push({
        examId: exam.examId,
        subject: exam.subject,
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt ?? null,
        deletedAt: exam.deletedAt ?? null,
        expiresAt: exam.expiresAt ?? null,
        questionCount: exam.questionUids.length,
        composition: exam.composition,
        policy: normalizeExamPolicyDefaults(exam.policy),
        visibility: normalizeExamVisibility(exam.visibility),
        hasSubmissions: taken
      });
    }
    return c.json({ items, cursor: list.list_complete ? undefined : list.cursor });
  });

  app.get("/admin/exams/:examId", requireAdmin, async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    const taken = await hasSubmissions(c.env, examId);
    return c.json({ exam: found.value, hasSubmissions: taken });
  });

  app.put("/admin/exams/:examId", requireAdmin, async (c) => {
    const examId = c.req.param("examId");
    const existing = await getExam(c.env, examId);
    if (!existing.ok) {
      const status = existing.status as 400 | 404 | 500;
      return c.text(existing.error, status);
    }
    if (existing.value.deletedAt) {
      return c.text("Exam deleted", 410);
    }
    let body: AdminExamBody;
    try {
      body = (await c.req.json()) as AdminExamBody;
    } catch {
      return c.text("Invalid body", 400);
    }
    if (body.subject !== "discrete-math") {
      return c.text("Unsupported subject", 400);
    }
    if (!Array.isArray(body.composition) || body.composition.length === 0) {
      return c.text("Composition is required", 400);
    }
    if (!body.policy || typeof body.policy !== "object") {
      return c.text("Policy is required", 400);
    }
    const normalizedPolicy = normalizeExamPolicyDefaults(body.policy);
    if (
      normalizedPolicy.versionCount !== undefined &&
      (!Number.isInteger(normalizedPolicy.versionCount) ||
        normalizedPolicy.versionCount < 2 ||
        normalizedPolicy.versionCount > 50)
    ) {
      return c.text("Invalid versionCount", 400);
    }
    if (
      normalizedPolicy.timeLimitMinutes !== undefined &&
      (!Number.isInteger(normalizedPolicy.timeLimitMinutes) ||
        normalizedPolicy.timeLimitMinutes < 1 ||
        normalizedPolicy.timeLimitMinutes > 300)
    ) {
      return c.text("Invalid timeLimitMinutes", 400);
    }

    const banks = await getLatestBanks(c.env, body.subject);
    if (!banks.ok) {
      const status = banks.status as 400 | 404 | 500;
      return c.text(banks.error, status);
    }

    const seed = body.seed ?? existing.value.seed;
    let questionUids: string[];
    try {
      questionUids = selectQuestions(body.composition, banks.value.publicBank, seed);
    } catch (err: any) {
      return c.text(err?.message ?? "Selection failed", 400);
    }

    const codesHashed = body.codes
      ? await Promise.all(body.codes.map((cde) => hashAccessCode(cde, examId, c.env.CODE_PEPPER)))
      : existing.value.codesHashed;

    const nextExpiresAt =
      body.expiresAt === null ? undefined : body.expiresAt ?? existing.value.expiresAt;
    const nextVisibility =
      body.visibility !== undefined ? normalizeExamVisibility(body.visibility) : existing.value.visibility;
    const nextTitle = body.title !== undefined ? body.title.trim() || undefined : existing.value.title;
    const updated: ExamV1 = {
      ...existing.value,
      subject: body.subject,
      seed,
      title: nextTitle,
      composition: body.composition,
      questionUids,
      policy: normalizedPolicy,
      codesHashed,
      expiresAt: nextExpiresAt,
      visibility: nextVisibility,
      updatedAt: new Date().toISOString()
    };
    const stored = await putExam(c.env, updated);
    if (!stored.ok) {
      const status = stored.status as 400 | 404 | 500;
      return c.text(stored.error, status);
    }
    const taken = await hasSubmissions(c.env, examId);
    return c.json({ examId, updatedAt: updated.updatedAt, hasSubmissions: taken });
  });

  app.post("/admin/exams/:examId/delete", requireAdmin, async (c) => {
    const examId = c.req.param("examId");
    let body: { mode?: "soft" | "hard" };
    try {
      body = (await c.req.json()) as { mode?: "soft" | "hard" };
    } catch {
      return c.text("Invalid body", 400);
    }
    const mode = body.mode === "hard" ? "hard" : "soft";
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (mode === "soft") {
      const updated: ExamV1 = {
        ...found.value,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const stored = await putExam(c.env, updated);
      if (!stored.ok) {
        const status = stored.status as 400 | 404 | 500;
        return c.text(stored.error, status);
      }
      return c.json({ examId, deletedAt: updated.deletedAt });
    }

    await c.env.QUIZ_KV.delete(`${EXAM_PREFIX}${examId}`);
    let deletedSubs = 0;
    let cursor: string | undefined;
    do {
      const list = await c.env.QUIZ_KV.list({ prefix: `sub:${examId}:`, cursor, limit: 1000 });
      for (const key of list.keys) {
        await c.env.QUIZ_KV.delete(key.name);
        deletedSubs += 1;
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return c.json({ examId, deleted: true, deletedSubmissions: deletedSubs });
  });

  app.post("/admin/exams/:examId/clone", requireAdmin, async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (found.value.deletedAt) {
      return c.text("Exam deleted", 410);
    }

    const newExamId = crypto.randomUUID();
    const cloned: ExamV1 = {
      ...found.value,
      examId: newExamId,
      createdAt: new Date().toISOString(),
      updatedAt: undefined,
      deletedAt: undefined
    };
    const stored = await putExam(c.env, cloned);
    if (!stored.ok) {
      const status = stored.status as 400 | 404 | 500;
      return c.text(stored.error, status);
    }
    const examUrl = `${c.env.UI_ORIGIN}/exam/${cloned.subject}/${newExamId}`;
    return c.json({ examId: newExamId, examUrl, seed: cloned.seed });
  });

  app.post("/admin/exams/:examId/restore", requireAdmin, async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (!found.value.deletedAt) {
      return c.text("Exam not deleted", 400);
    }
    const restored: ExamV1 = {
      ...found.value,
      deletedAt: undefined,
      updatedAt: new Date().toISOString()
    };
    const stored = await putExam(c.env, restored);
    if (!stored.ok) {
      const status = stored.status as 400 | 404 | 500;
      return c.text(stored.error, status);
    }
    return c.json({ examId, restoredAt: restored.updatedAt });
  });

  app.post("/admin/exams/:examId/shortlink", requireAdmin, async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (isDeleted(found.value.deletedAt)) return c.text("Exam deleted", 410);
    if (isExpired(found.value.expiresAt)) return c.text("Exam expired", 410);

    const existingCode = await c.env.QUIZ_KV.get(`${SHORT_EXAM_PREFIX}${examId}`);
    const ttl = getExpiryTtlSeconds(found.value.expiresAt);
    if (existingCode) {
      const shortUrl = `${c.env.UI_ORIGIN}/#/s/${existingCode}`;
      return c.json({ code: existingCode, shortUrl });
    }

    let code = "";
    for (let i = 0; i < 5; i += 1) {
      const next = randomShortCode(8);
      const exists = await c.env.QUIZ_KV.get(`${SHORT_PREFIX}${next}`);
      if (!exists) {
        code = next;
        break;
      }
    }
    if (!code) return c.text("Failed to generate short link", 500);

    const payload = JSON.stringify({ examId, subject: found.value.subject });
    const options = ttl ? { expirationTtl: ttl } : undefined;
    await c.env.QUIZ_KV.put(`${SHORT_PREFIX}${code}`, payload, options);
    await c.env.QUIZ_KV.put(`${SHORT_EXAM_PREFIX}${examId}`, code, options);

    const shortUrl = `${c.env.UI_ORIGIN}/#/s/${code}`;
    return c.json({ code, shortUrl });
  });

  app.post("/admin/exams/import", requireAdmin, async (c) => {
    let body: { items?: ExamV1[]; mode?: "overwrite" };
    try {
      body = (await c.req.json()) as { items?: ExamV1[]; mode?: "overwrite" };
    } catch {
      return c.text("Invalid body", 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return c.text("No exams provided", 400);
    }
    const results = [];
    for (const exam of body.items) {
      const parsed = ExamV1Schema.safeParse(exam);
      if (!parsed.success) {
        results.push({ examId: "", ok: false, error: "Invalid exam" });
        continue;
      }
      const exists = await getExam(c.env, parsed.data.examId);
      if (exists.ok && body.mode !== "overwrite") {
        results.push({ examId: parsed.data.examId, ok: false, error: "Exam exists" });
        continue;
      }
      await c.env.QUIZ_KV.put(`${EXAM_PREFIX}${parsed.data.examId}`, JSON.stringify(parsed.data));
      results.push({ examId: parsed.data.examId, ok: true });
    }
    return c.json({ results });
  });

  app.get("/admin/templates", requireAdmin, async (c) => {
    const limit = parseLimit(c.req.query("limit"));
    const cursor = c.req.query("cursor") ?? undefined;
    const list = await c.env.QUIZ_KV.list({ prefix: TEMPLATE_PREFIX, limit, cursor });
    const items = [];
    for (const key of list.keys) {
      const raw = await c.env.QUIZ_KV.get(key.name);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        items.push(parsed);
      } catch {
        continue;
      }
    }
    return c.json({ items, cursor: list.list_complete ? undefined : list.cursor });
  });

  app.get("/admin/templates/:templateId", requireAdmin, async (c) => {
    const templateId = c.req.param("templateId");
    const raw = await c.env.QUIZ_KV.get(`${TEMPLATE_PREFIX}${templateId}`);
    if (!raw) return c.text("Template not found", 404);
    return c.json(JSON.parse(raw));
  });

  app.post("/admin/templates", requireAdmin, async (c) => {
    let body: ExamTemplateBody;
    try {
      body = parseTemplateBody(await c.req.json());
    } catch (err: any) {
      return c.text(err?.message ?? "Invalid body", 400);
    }
    const templateId = crypto.randomUUID();
    const now = new Date().toISOString();
    const record = {
      templateId,
      name: body.name,
      createdAt: now,
      updatedAt: now,
      template: body.template
    };
    await c.env.QUIZ_KV.put(`${TEMPLATE_PREFIX}${templateId}`, JSON.stringify(record));
    return c.json(record);
  });

  app.put("/admin/templates/:templateId", requireAdmin, async (c) => {
    const templateId = c.req.param("templateId");
    const raw = await c.env.QUIZ_KV.get(`${TEMPLATE_PREFIX}${templateId}`);
    if (!raw) return c.text("Template not found", 404);
    let existing: any;
    try {
      existing = JSON.parse(raw);
    } catch {
      return c.text("Template invalid", 400);
    }
    let body: Partial<ExamTemplateBody>;
    try {
      body = (await c.req.json()) as Partial<ExamTemplateBody>;
    } catch {
      return c.text("Invalid body", 400);
    }
    const name = typeof body.name === "string" ? body.name.trim() : existing.name;
    const template = body.template ?? existing.template;
    const record = {
      ...existing,
      name,
      template,
      updatedAt: new Date().toISOString()
    };
    await c.env.QUIZ_KV.put(`${TEMPLATE_PREFIX}${templateId}`, JSON.stringify(record));
    return c.json(record);
  });

  app.delete("/admin/templates/:templateId", requireAdmin, async (c) => {
    const templateId = c.req.param("templateId");
    await c.env.QUIZ_KV.delete(`${TEMPLATE_PREFIX}${templateId}`);
    return c.json({ ok: true });
  });

  app.post("/admin/templates/import", requireAdmin, async (c) => {
    let body: { items?: ExamTemplateBody[] };
    try {
      body = (await c.req.json()) as { items?: ExamTemplateBody[] };
    } catch {
      return c.text("Invalid body", 400);
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return c.text("No templates provided", 400);
    }
    const results = [];
    for (const item of body.items) {
      try {
        const parsed = parseTemplateBody(item);
        const templateId = crypto.randomUUID();
        const now = new Date().toISOString();
        const record = {
          templateId,
          name: parsed.name,
          createdAt: now,
          updatedAt: now,
          template: parsed.template
        };
        await c.env.QUIZ_KV.put(`${TEMPLATE_PREFIX}${templateId}`, JSON.stringify(record));
        results.push({ templateId, ok: true });
      } catch (err: any) {
        results.push({ templateId: "", ok: false, error: err?.message ?? "Invalid template" });
      }
    }
    return c.json({ results });
  });
}
