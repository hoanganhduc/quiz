import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { getUser, putUser } from "../users/store";
import { AppUserSchema, type AppUser } from "@app/shared";

type UserSummary = {
  appUserId: string;
  roles: string[];
  githubUsername?: string;
  googleEmail?: string;
  displayName?: string;
};

function toSummary(user: AppUser): UserSummary {
  return {
    appUserId: user.appUserId,
    roles: user.roles,
    githubUsername: user.linked.github?.username,
    googleEmail: user.linked.google?.email,
    displayName: user.profile.displayName
  };
}

export function registerAdminUserRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/admin/users/search", requireAdmin, async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json({ users: [] });

    const lower = q.toLowerCase();
    const results: UserSummary[] = [];

    if (AppUserSchema.shape.appUserId.safeParse(q).success) {
      const user = await getUser(c.env, q);
      if (user) results.push(toSummary(user));
    }

    const list = await c.env.QUIZ_KV.list({ prefix: "user:" });
    for (const key of list.keys) {
      if (!key.name.startsWith("user:")) continue;
      const appUserId = key.name.slice("user:".length);
      if (results.some((u) => u.appUserId === appUserId)) continue;
      const raw = await c.env.QUIZ_KV.get(key.name);
      if (!raw) continue;
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        continue;
      }
      const parsed = AppUserSchema.safeParse(json);
      if (!parsed.success) continue;
      const user = parsed.data;
      const githubUsername = user.linked.github?.username;
      const googleEmail = user.linked.google?.email;
      const matchesGithub =
        githubUsername &&
        (githubUsername.toLowerCase() === lower || githubUsername.toLowerCase().includes(lower));
      const matchesGoogle =
        googleEmail &&
        (googleEmail.toLowerCase() === lower || googleEmail.toLowerCase().includes(lower));

      if (matchesGithub || matchesGoogle) {
        results.push(toSummary(user));
      }
    }

    return c.json({ users: results });
  });

  app.post("/admin/users/:appUserId/roles", requireAdmin, async (c) => {
    const appUserId = c.req.param("appUserId");
    let body: { makeAdmin?: boolean };
    try {
      body = (await c.req.json()) as { makeAdmin?: boolean };
    } catch {
      return c.text("Invalid body", 400);
    }

    if (typeof body.makeAdmin !== "boolean") {
      return c.text("Invalid body", 400);
    }

    const user = await getUser(c.env, appUserId);
    if (!user) return c.text("User not found", 404);

    const nextRoles = body.makeAdmin
      ? Array.from(new Set([...user.roles, "admin"]))
      : user.roles.filter((role) => role !== "admin");

    const updated: AppUser = {
      ...user,
      roles: nextRoles,
      updatedAt: new Date().toISOString()
    };
    await putUser(c.env, updated);

    return c.json({ user: toSummary(updated) });
  });
}
