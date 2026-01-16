import type { Hono } from "hono";
import type { Env } from "../env";
import { readSession } from "../session";
import { isLoggedInUser, SubmissionV1Schema, type SubmissionSummaryV1 } from "@app/shared";
import { getSubmissionOwnerMap, listUserSubmissionIndex, putUserSubmissionIndex } from "./index";
import { getExam, getLatestBanks, getSubmission, putSubmission } from "../kv";
import { makeVersionSeed, shuffleChoicesForQuestion } from "../exam/versioning";

const submissionKey = (examId: string, submissionId: string) => `sub:${examId}:${submissionId}`;

export function registerSubmissionRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/me/submissions", async (c) => {
    const session = await readSession(c.env, c.req.raw);
    if (!session || !isLoggedInUser(session)) {
      return c.text("Unauthorized", 401);
    }

    const limitParam = c.req.query("limit");
    const cursor = c.req.query("cursor") ?? undefined;
    const limit = limitParam ? Number(limitParam) : 20;
    const includeDeleted = c.req.query("includeDeleted") === "1";

    const result = await listUserSubmissionIndex(c.env, session.appUserId, limit, cursor);

    let submissions = result.items;
    if (!includeDeleted) {
      submissions = submissions.filter(s => !s.deletedAt);
    }

    return c.json({ submissions, nextCursor: result.cursor });
  });

  // Batch Soft Delete
  app.post("/me/submissions/batch-delete", async (c) => {
    const session = await readSession(c.env, c.req.raw);
    if (!session || !isLoggedInUser(session)) return c.text("Unauthorized", 401);

    const { submissionIds }: { submissionIds: string[] } = await c.req.json();
    if (!Array.isArray(submissionIds)) return c.text("Invalid body", 400);

    const now = new Date().toISOString();
    const results = { count: 0, failed: [] as string[] };

    for (const sid of submissionIds) {
      try {
        const map = await getSubmissionOwnerMap(c.env, sid);
        if (!map || map.ownerAppUserId !== session.appUserId) {
          results.failed.push(sid);
          continue;
        }

        const subRes = await getSubmission(c.env, map.examId, sid);
        if (!subRes.ok) {
          results.failed.push(sid);
          continue;
        }

        const sub = subRes.value;
        sub.deletedAt = now;
        await putSubmission(c.env, sub);

        // Update user index too
        const summary: SubmissionSummaryV1 = {
          submissionId: sub.submissionId,
          examId: sub.examId,
          submittedAt: sub.submittedAt,
          score: sub.score,
          version: sub.version,
          deletedAt: now
        };
        await putUserSubmissionIndex(c.env, session.appUserId, summary);

        results.count++;
      } catch {
        results.failed.push(sid);
      }
    }

    return c.json(results);
  });

  // Batch Restore
  app.post("/me/submissions/batch-restore", async (c) => {
    const session = await readSession(c.env, c.req.raw);
    if (!session || !isLoggedInUser(session)) return c.text("Unauthorized", 401);

    const { submissionIds }: { submissionIds: string[] } = await c.req.json();
    if (!Array.isArray(submissionIds)) return c.text("Invalid body", 400);

    const results = { count: 0, failed: [] as string[] };

    for (const sid of submissionIds) {
      try {
        const map = await getSubmissionOwnerMap(c.env, sid);
        if (!map || map.ownerAppUserId !== session.appUserId) {
          results.failed.push(sid);
          continue;
        }

        const subRes = await getSubmission(c.env, map.examId, sid);
        if (!subRes.ok) {
          results.failed.push(sid);
          continue;
        }

        const sub = subRes.value;
        delete sub.deletedAt;
        await putSubmission(c.env, sub);

        // Update user index too
        const summary: SubmissionSummaryV1 = {
          submissionId: sub.submissionId,
          examId: sub.examId,
          submittedAt: sub.submittedAt,
          score: sub.score,
          version: sub.version
        };
        await putUserSubmissionIndex(c.env, session.appUserId, summary);

        results.count++;
      } catch {
        results.failed.push(sid);
      }
    }

    return c.json(results);
  });

  // Batch Hard Delete
  app.post("/me/submissions/batch-hard-delete", async (c) => {
    const session = await readSession(c.env, c.req.raw);
    if (!session || !isLoggedInUser(session)) return c.text("Unauthorized", 401);

    const { submissionIds }: { submissionIds: string[] } = await c.req.json();
    if (!Array.isArray(submissionIds)) return c.text("Invalid body", 400);

    const results = { count: 0, failed: [] as string[] };

    for (const sid of submissionIds) {
      try {
        const map = await getSubmissionOwnerMap(c.env, sid);
        if (!map || map.ownerAppUserId !== session.appUserId) {
          results.failed.push(sid);
          continue;
        }

        // We need to find the specific userSub key because it contains a timestamp
        const subRes = await getSubmission(c.env, map.examId, sid);
        if (subRes.ok) {
          const sub = subRes.value;
          const submittedAtMs = Date.parse(sub.submittedAt);
          const invTs = 9999999999999 - submittedAtMs;
          const userSubKey = `userSub:${session.appUserId}:${String(invTs).padStart(13, "0")}:${sid}`;
          await c.env.QUIZ_KV.delete(userSubKey);
        }

        await c.env.QUIZ_KV.delete(`sub:${map.examId}:${sid}`);
        await c.env.QUIZ_KV.delete(`subid:${sid}`);

        results.count++;
      } catch {
        results.failed.push(sid);
      }
    }

    return c.json(results);
  });

  app.get("/me/submissions/:submissionId", async (c) => {
    const session = await readSession(c.env, c.req.raw);
    if (!session || !isLoggedInUser(session)) {
      return c.text("Unauthorized", 401);
    }

    const submissionId = c.req.param("submissionId");
    const map = await getSubmissionOwnerMap(c.env, submissionId);
    if (!map) return c.text("Not found", 404);
    if (map.ownerAppUserId !== session.appUserId) {
      return c.text("Forbidden", 403);
    }

    const raw = await c.env.QUIZ_KV.get(submissionKey(map.examId, submissionId));
    if (!raw) return c.text("Not found", 404);
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return c.text("Not found", 404);
    }
    const parsed = SubmissionV1Schema.safeParse(json);
    if (!parsed.success) {
      return c.text("Not found", 404);
    }

    const submission = parsed.data;

    // Enrich with question data if possible
    const [examRes, banksRes] = await Promise.all([
      getExam(c.env, submission.examId),
      getLatestBanks(c.env, "discrete-math") // Hardcoded subject for now as per project scope
    ]);

    if (examRes.ok && banksRes.ok) {
      const exam = examRes.value;
      const mapAns = new Map(banksRes.value.answersBank.questions.map(q => [q.uid, q]));

      const versionSeed = submission.version
        ? makeVersionSeed(exam.seed, submission.identity.userId, submission.version.versionIndex)
        : undefined;

      submission.perQuestion = submission.perQuestion.map(pq => {
        const question = mapAns.get(pq.uid);
        if (question) {
          pq.prompt = question.prompt;
          if (question.type === "mcq-single") {
            if (versionSeed && exam.policy.shuffleChoices) {
              pq.choices = shuffleChoicesForQuestion(question, versionSeed).choices;
            } else {
              pq.choices = question.choices;
            }
          }
        }
        return pq;
      });
    }

    return c.json({ submission });
  });
}
