import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { getSubmission, putSubmission } from "../kv";
import { getSubmissionOwnerMap, putUserSubmissionIndex } from "../submissions/index";
import { SubmissionSummaryV1, SubmissionV1 } from "@app/shared";

export function registerAdminSubmissionRoutes(app: Hono<{ Bindings: Env }>) {
    const admin = app.basePath("/admin/submissions");
    admin.use("*", requireAdmin);

    // List all submissions (global)
    admin.get("/", async (c) => {
        const limitParam = c.req.query("limit");
        const cursor = c.req.query("cursor") ?? undefined;
        const limit = limitParam ? Math.min(100, Number(limitParam)) : 50;

        // We list by prefix 'sub:'
        const list = await c.env.QUIZ_KV.list({ prefix: "sub:", limit, cursor });

        const submissions: SubmissionV1[] = [];
        for (const key of list.keys) {
            const raw = await c.env.QUIZ_KV.get(key.name);
            if (!raw) continue;
            try {
                const item = JSON.parse(raw) as SubmissionV1;
                submissions.push(item);
            } catch {
                // ignore malformed
            }
        }

        return c.json({
            submissions,
            nextCursor: list.list_complete ? undefined : list.cursor
        });
    });

    // Batch Soft Delete
    admin.post("/batch-delete", async (c) => {
        const { submissionIds }: { submissionIds: string[] } = await c.req.json();
        if (!Array.isArray(submissionIds)) return c.text("Invalid body", 400);

        const now = new Date().toISOString();
        const results = { count: 0, failed: [] as string[] };

        for (const sid of submissionIds) {
            try {
                const map = await getSubmissionOwnerMap(c.env, sid);
                if (!map) {
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
                await putUserSubmissionIndex(c.env, map.ownerAppUserId, summary);

                results.count++;
            } catch {
                results.failed.push(sid);
            }
        }

        return c.json(results);
    });

    // Batch Restore
    admin.post("/batch-restore", async (c) => {
        const { submissionIds }: { submissionIds: string[] } = await c.req.json();
        if (!Array.isArray(submissionIds)) return c.text("Invalid body", 400);

        const results = { count: 0, failed: [] as string[] };

        for (const sid of submissionIds) {
            try {
                const map = await getSubmissionOwnerMap(c.env, sid);
                if (!map) {
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
                    // deletedAt is omitted
                };
                await putUserSubmissionIndex(c.env, map.ownerAppUserId, summary);

                results.count++;
            } catch {
                results.failed.push(sid);
            }
        }

        return c.json(results);
    });

    // Batch Hard Delete
    admin.post("/batch-hard-delete", async (c) => {
        const { submissionIds }: { submissionIds: string[] } = await c.req.json();
        if (!Array.isArray(submissionIds)) return c.text("Invalid body", 400);

        const results = { count: 0, failed: [] as string[] };

        for (const sid of submissionIds) {
            try {
                const map = await getSubmissionOwnerMap(c.env, sid);
                if (!map) {
                    // Maybe it's already gone or index is missing, try a direct sub: search if we had examId
                    // But without examId we can't easily find the key sub:examId:sid
                    results.failed.push(sid);
                    continue;
                }

                const subKey = `sub:${map.examId}:${sid}`;
                const ownerIndexKeyPrefix = `userSub:${map.ownerAppUserId}:`;

                // We need to find the specific userSub key because it contains a timestamp
                // Finding it requires a list or knowing the timestamp exactly
                // Let's fetch the submission first to get submittedAt
                const subRes = await getSubmission(c.env, map.examId, sid);
                if (subRes.ok) {
                    const sub = subRes.value;
                    const submittedAtMs = Date.parse(sub.submittedAt);
                    const invTs = 9999999999999 - submittedAtMs;
                    const userSubKey = `${ownerIndexKeyPrefix}${String(invTs).padStart(13, "0")}:${sid}`;
                    await c.env.QUIZ_KV.delete(userSubKey);
                }

                await c.env.QUIZ_KV.delete(subKey);
                await c.env.QUIZ_KV.delete(`subid:${sid}`);

                results.count++;
            } catch {
                results.failed.push(sid);
            }
        }

        return c.json(results);
    });
}
