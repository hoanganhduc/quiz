import type { Context, Hono } from "hono";
import {
  AnswerValueV1,
  BankAnswersV1,
  BankPublicV1,
  ChoiceKey,
  ExamV1,
  ExamPolicyV1,
  ExamVisibility,
  SubmissionIdentityV1,
  getSubtopicIdsForCategory,
  isLoggedInUser,
  isTopicCategory,
  normalizeExamVisibility,
  normalizeExamPolicyDefaults,
  type AppUser,
  type ExamCompositionItemV1,
  type ExamCompositionLevel,
  type QuestionLevel,
  type SessionV2,
  type SubmissionSummaryV1
} from "@app/shared";
import { getExam, getLatestBanks, putExam, putSubmission } from "./kv";
import type { Env } from "./env";
import { issueSessionCookie, readSession } from "./session";
import { createRng, hashAccessCode, shuffle } from "./utils";
import { putUser } from "./users/store";
import { requireAdmin } from "./admin/requireAdmin";
import { putSubmissionOwnerMap, putUserSubmissionIndex } from "./submissions";
import { getSourcesConfig } from "./sources/store";
import {
  computeVersionId,
  computeVersionIndex,
  deterministicShuffle,
  getIdentityKey,
  makeVersionSeed,
  shuffleChoicesForQuestion
} from "./exam/versioning";

type AdminExamBody = {
  subject: string;
  composition: ExamCompositionItemV1[];
  title?: string;
  seed?: string;
  policy: ExamPolicyV1;
  codes?: string[];
  expiresAt?: string | null;
  visibility?: ExamVisibility;
  notice?: string;
};

type SubmitBody = { answers: Record<string, AnswerValueV1>; code?: string };

type Ctx = Context<{ Bindings: Env }>;

function unauthorized(c: Ctx) {
  return c.text("Unauthorized", 401);
}

function forbidden(c: Ctx) {
  return c.text("Forbidden", 403);
}

function sessionToIdentity(session: SessionV2): SubmissionIdentityV1 {
  const provider = session.providers.includes("github")
    ? "github"
    : session.providers.includes("google")
      ? "google"
      : "anon";
  return {
    provider,
    userId: session.appUserId,
    name: session.displayName
  };
}

async function requireSessionIfNeeded(
  c: Ctx,
  mode: ExamPolicyV1["authMode"]
): Promise<{ identity: SubmissionIdentityV1; owner: { appUserId?: string; anonymousId?: string } } | null> {
  const session = await readSession(c.env, c.req.raw);
  if (!session) {
    if (mode === "required") return null;
    const anonId = crypto.randomUUID();
    return { identity: { provider: "anon", userId: anonId }, owner: { anonymousId: anonId } };
  }
  if (isLoggedInUser(session)) {
    return { identity: sessionToIdentity(session), owner: { appUserId: session.appUserId } };
  }
  return { identity: sessionToIdentity(session), owner: { anonymousId: session.appUserId } };
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return Date.now() > Date.parse(expiresAt);
}

function isDeleted(deletedAt?: string): boolean {
  if (!deletedAt) return false;
  return Date.now() >= Date.parse(deletedAt);
}

function isOpenExam(exam: ExamV1): boolean {
  const policy = normalizeExamPolicyDefaults(exam.policy);
  if (policy.authMode === "required") return false;
  if (policy.requireViewCode || policy.requireSubmitCode) return false;
  return true;
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

async function checkCode(env: Env, exam: ExamV1, code: string | undefined): Promise<boolean> {
  if (exam.codesHashed.length === 0) return true;
  if (!code) return false;
  const hashed = await hashAccessCode(code, exam.examId, env.CODE_PEPPER);
  return exam.codesHashed.includes(hashed);
}

function pickQuestions(
  uids: string[],
  bankPublic: BankPublicV1,
  bankAnswers: BankAnswersV1,
  includeSolutions: boolean
) {
  const mapPublic = new Map(bankPublic.questions.map((q) => [q.uid, q]));
  const mapAns = new Map(bankAnswers.questions.map((q) => [q.uid, q]));
  return uids
    .map((uid) => {
      const pub = mapPublic.get(uid);
      const ans = mapAns.get(uid);
      if (!pub || !ans) return null;
      if (!includeSolutions) {
        if (ans.type === "mcq-single") {
          const { answerKey, solution, ...rest } = ans;
          return rest;
        }
        const { answers, solution, ...rest } = ans;
        return rest;
      }
      return ans;
    })
    .filter((q): q is NonNullable<typeof q> => q !== null);
}

export function registerExamRoutes(app: Hono<{ Bindings: Env }>) {
  app.post("/auth/anonymous", async (c) => {
    const now = new Date().toISOString();
    const appUserId = crypto.randomUUID();
    const user: AppUser = {
      appUserId,
      createdAt: now,
      updatedAt: now,
      roles: [],
      profile: {},
      linked: {}
    };
    await putUser(c.env, user);
    const session: SessionV2 = {
      appUserId,
      roles: [],
      providers: ["anon"],
      displayName: "Anonymous"
    };
    const cookie = await issueSessionCookie(c.env, c.req.raw, session);
    const res = c.json({ ok: true });
    res.headers.append("Set-Cookie", cookie);
    return res;
  });

  app.post("/admin/exams", requireAdmin, async (c) => {
    let body: AdminExamBody;
    try {
      body = (await c.req.json()) as AdminExamBody;
    } catch {
      return c.text("Invalid body", 400);
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

    const seed = body.seed ?? crypto.randomUUID();
    let questionUids: string[];
    try {
      questionUids = selectQuestions(body.composition, banks.value.publicBank, seed);
    } catch (err: any) {
      return c.text(err?.message ?? "Selection failed", 400);
    }

    const examId = crypto.randomUUID();
    const codesHashed = body.codes
      ? await Promise.all(body.codes.map((cde) => hashAccessCode(cde, examId, c.env.CODE_PEPPER)))
      : [];

    const exam: ExamV1 = {
      examId,
      subject: body.subject,
      createdAt: new Date().toISOString(),
      title: body.title?.trim() || undefined,
      seed,
      composition: body.composition,
      questionUids,
      policy: normalizedPolicy,
      codesHashed,
      expiresAt: body.expiresAt ?? undefined,
      visibility: normalizeExamVisibility(body.visibility),
      notice: body.notice?.trim() || undefined
    };

    const stored = await putExam(c.env, exam);
    if (!stored.ok) {
      const status = stored.status as 400 | 404 | 500;
      return c.text(stored.error, status);
    }

    const examUrl = `${c.env.UI_ORIGIN}/exam/${body.subject}/${examId}`;
    return c.json({ examId, examUrl, seed });
  });

  app.get("/admin/exams/:examId/template", requireAdmin, async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }

    const policy = normalizeExamPolicyDefaults(found.value.policy);
    return c.json({
      examId: found.value.examId,
      subject: found.value.subject,
      composition: found.value.composition,
      policy,
      expiresAt: found.value.expiresAt ?? null,
      visibility: normalizeExamVisibility(found.value.visibility)
    });
  });

  app.get("/exam/:examId/config", async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (isDeleted(found.value.deletedAt)) return c.text("Exam deleted", 410);
    if (isExpired(found.value.expiresAt)) return c.text("Exam expired", 410);

    const policy = normalizeExamPolicyDefaults(found.value.policy);
    const resolved = await requireSessionIfNeeded(c, policy.authMode);
    if (!resolved && policy.authMode === "required") return unauthorized(c);

    const sources = await getSourcesConfig(c.env);
    const subjectDef = sources.subjects.find(s => s.id === found.value.subject);

    return c.json({
      examId: found.value.examId,
      subject: found.value.subject,
      subjectTitle: subjectDef?.title ?? found.value.subject,
      title: found.value.title ?? null,
      composition: found.value.composition,
      policy,
      expiresAt: found.value.expiresAt ?? null,
      auth: resolved ? resolved.identity.provider : null,
      visibility: normalizeExamVisibility(found.value.visibility),
      notice: found.value.notice ?? null
    });
  });

  app.get("/exam/:examId/bank", async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (isDeleted(found.value.deletedAt)) return c.text("Exam deleted", 410);
    if (isExpired(found.value.expiresAt)) return c.text("Exam expired", 410);

    const policy = normalizeExamPolicyDefaults(found.value.policy);
    const includeSolutions = policy.solutionsMode === "always";
    const resolved = await requireSessionIfNeeded(c, policy.authMode);
    if (!resolved && policy.authMode === "required") return unauthorized(c);

    if (policy.requireViewCode) {
      const code = c.req.query("code");
      const ok = await checkCode(c.env, found.value, code);
      if (!ok) return forbidden(c);
    }

    const banks = await getLatestBanks(c.env, found.value.subject);
    if (!banks.ok) {
      const status = banks.status as 400 | 404 | 500;
      return c.text(banks.error, status);
    }

    const isPerStudent = policy.versioningMode === "per_student";
    const identityKey = getIdentityKey(resolved?.owner ?? {});
    const versionIndex = isPerStudent
      ? await computeVersionIndex(found.value.seed, identityKey, policy.versionCount)
      : undefined;
    const versionId = await computeVersionId(
      examId,
      found.value.seed,
      isPerStudent ? identityKey : "fixed",
      isPerStudent ? versionIndex : undefined
    );
    const versionSeed = makeVersionSeed(
      found.value.seed,
      isPerStudent ? identityKey : "fixed",
      isPerStudent ? versionIndex : undefined
    );

    const baseOrder = isPerStudent && policy.shuffleQuestions
      ? deterministicShuffle(found.value.questionUids, versionSeed)
      : found.value.questionUids;

    const mapPublic = new Map(banks.value.publicBank.questions.map((q) => [q.uid, q]));
    const mapAns = new Map(banks.value.answersBank.questions.map((q) => [q.uid, q]));

    const questions = baseOrder
      .map((uid) => {
        const pub = mapPublic.get(uid);
        const ans = mapAns.get(uid);
        if (!pub || !ans) return null;
        const baseQuestion: any = includeSolutions ? { ...ans } : { ...pub };
        if (
          isPerStudent &&
          policy.shuffleChoices &&
          ans.type === "mcq-single" &&
          baseQuestion.type === "mcq-single"
        ) {
          const shuffled = shuffleChoicesForQuestion(ans, versionSeed);
          baseQuestion.choices = shuffled.choices;
          if (includeSolutions) baseQuestion.answerKey = shuffled.displayedCorrectKey;
        }
        return baseQuestion;
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    return c.json({
      examId,
      version: { versionId, versionIndex },
      questions
    });
  });

  app.post("/exam/:examId/submit", async (c) => {
    const examId = c.req.param("examId");
    const found = await getExam(c.env, examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (isDeleted(found.value.deletedAt)) return c.text("Exam deleted", 410);
    if (isExpired(found.value.expiresAt)) return c.text("Exam expired", 410);

    let body: SubmitBody;
    try {
      body = (await c.req.json()) as SubmitBody;
    } catch {
      return c.text("Invalid body", 400);
    }

    const policy = normalizeExamPolicyDefaults(found.value.policy);
    const resolved = await requireSessionIfNeeded(c, policy.authMode);
    if (!resolved && policy.authMode === "required") return unauthorized(c);
    const finalIdentity =
      resolved?.identity ?? { provider: "anon", userId: crypto.randomUUID() };
    const owner =
      resolved?.owner ?? { anonymousId: finalIdentity.userId };

    if (policy.requireSubmitCode) {
      const ok = await checkCode(c.env, found.value, body.code);
      if (!ok) return forbidden(c);
    }

    const banks = await getLatestBanks(c.env, found.value.subject);
    if (!banks.ok) {
      const status = banks.status as 400 | 404 | 500;
      return c.text(banks.error, status);
    }
    const mapAns = new Map(banks.value.answersBank.questions.map((q) => [q.uid, q]));

    const isPerStudent = policy.versioningMode === "per_student";
    const identityKey = getIdentityKey(owner);
    const versionIndex = isPerStudent
      ? await computeVersionIndex(found.value.seed, identityKey, policy.versionCount)
      : undefined;
    const versionId = await computeVersionId(
      examId,
      found.value.seed,
      isPerStudent ? identityKey : "fixed",
      isPerStudent ? versionIndex : undefined
    );
    const versionSeed = makeVersionSeed(
      found.value.seed,
      isPerStudent ? identityKey : "fixed",
      isPerStudent ? versionIndex : undefined
    );

    const normalizeText = (s: string) => s.trim().replace(/\s+/g, " ");

    const perQuestion = found.value.questionUids.map((uid) => {
      const answer = mapAns.get(uid);
      if (!answer) return null;

      const chosenRaw = body.answers[uid];
      const revealSolutions =
        policy.solutionsMode === "always" || policy.solutionsMode === "after_submit";

      if (answer.type === "mcq-single") {
        const chosen = Array.isArray(chosenRaw) ? (chosenRaw[0] ?? "") : (chosenRaw ?? "");
        const displayedCorrect =
          isPerStudent && policy.shuffleChoices
            ? shuffleChoicesForQuestion(answer, versionSeed).displayedCorrectKey
            : answer.answerKey;
        const correct = chosen === displayedCorrect;
        return {
          uid,
          chosen,
          correct,
          answerKey: revealSolutions ? answer.answerKey : undefined,
          solution: revealSolutions ? answer.solution : undefined
        };
      }

      if (answer.type === "fill-blank") {
        const chosenArr = Array.isArray(chosenRaw)
          ? chosenRaw
          : typeof chosenRaw === "string"
            ? [chosenRaw]
            : [];
        const correct =
          chosenArr.length === answer.answers.length &&
          answer.answers.every((exp, i) => normalizeText(chosenArr[i] ?? "") === normalizeText(exp));
        return {
          uid,
          chosen: chosenArr,
          correct,
          expected: revealSolutions ? answer.answers : undefined,
          solution: revealSolutions ? answer.solution : undefined
        };
      }

      return null;
    });

    const filtered = perQuestion.filter((p): p is NonNullable<typeof p> => p !== null);
    const score = {
      correct: filtered.filter((p) => p.correct).length,
      total: filtered.length
    };

    const submission = {
      submissionId: crypto.randomUUID(),
      examId,
      submittedAt: new Date().toISOString(),
      owner,
      identity: finalIdentity,
      answers: body.answers,
      score,
      perQuestion: filtered,
      version: { versionId, versionIndex }
    };

    await putSubmission(c.env, submission);

    if (submission.owner.appUserId) {
      const summary: SubmissionSummaryV1 = {
        submissionId: submission.submissionId,
        examId: submission.examId,
        submittedAt: submission.submittedAt,
        score,
        version: submission.version
      };
      await putUserSubmissionIndex(c.env, submission.owner.appUserId, summary);
      await putSubmissionOwnerMap(c.env, submission.submissionId, {
        examId: submission.examId,
        ownerAppUserId: submission.owner.appUserId
      });
    }

    return c.json({
      ok: true,
      submission: {
        submissionId: submission.submissionId,
        examId: submission.examId,
        submittedAt: submission.submittedAt,
        score,
        perQuestion: filtered,
        version: submission.version
      }
    });
  });

  app.get("/public/exams", async (c) => {
    const list = await c.env.QUIZ_KV.list({ prefix: "exam:", limit: 1000 });
    const sources = await getSourcesConfig(c.env);
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
      if (isDeleted(exam.deletedAt) || isExpired(exam.expiresAt)) continue;
      if (normalizeExamVisibility(exam.visibility) !== "public") continue;
      if (!isOpenExam(exam)) continue;

      const shortCode = await c.env.QUIZ_KV.get(`shortExam:${exam.examId}`);
      const subjectDef = sources.subjects.find(s => s.id === exam.subject);

      items.push({
        examId: exam.examId,
        subject: exam.subject,
        subjectTitle: subjectDef?.title ?? exam.subject,
        title: exam.title,
        createdAt: exam.createdAt,
        expiresAt: exam.expiresAt ?? null,
        shortLinkCode: shortCode ?? undefined
      });
    }
    return c.json({ items });
  });

  app.get("/public/short/:code", async (c) => {
    const code = c.req.param("code");
    if (!code) return c.text("Missing code", 400);
    const raw = await c.env.QUIZ_KV.get(`short:${code}`);
    if (!raw) return c.text("Not found", 404);
    let data: { examId?: string; subject?: string };
    try {
      data = JSON.parse(raw) as { examId?: string; subject?: string };
    } catch {
      return c.text("Invalid short link", 400);
    }
    if (!data.examId || !data.subject) return c.text("Invalid short link", 400);
    const found = await getExam(c.env, data.examId);
    if (!found.ok) {
      const status = found.status as 400 | 404 | 500;
      return c.text(found.error, status);
    }
    if (isDeleted(found.value.deletedAt)) return c.text("Exam deleted", 410);
    if (isExpired(found.value.expiresAt)) return c.text("Exam expired", 410);
    return c.json({ examId: data.examId, subject: data.subject });
  });
}
