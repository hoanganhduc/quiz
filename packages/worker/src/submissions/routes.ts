import type { Hono } from "hono";
import type { Env } from "../env";
import { readSession } from "../session";
import { isLoggedInUser, SubmissionV1Schema } from "@app/shared";
import { getSubmissionOwnerMap, listUserSubmissionIndex } from "./index";

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

    const result = await listUserSubmissionIndex(c.env, session.appUserId, limit, cursor);
    return c.json({ items: result.items, cursor: result.cursor });
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

    return c.json({ submission: parsed.data });
  });
}
