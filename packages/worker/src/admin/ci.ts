import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";

type TriggerBody = { ref?: string };

export function registerAdminCiRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/admin/ci/status", requireAdmin, async (c) => {
    const token = c.env.GITHUB_CI_TOKEN;
    const owner = c.env.GITHUB_CI_OWNER;
    const repo = c.env.GITHUB_CI_REPO;
    const workflow = c.env.GITHUB_CI_WORKFLOW ?? "deploy.yml";
    const ref = c.req.query("ref") ?? c.env.GITHUB_CI_REF ?? "main";

    if (!token || !owner || !repo) {
      return c.text("Missing GitHub CI configuration", 400);
    }

    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs`
    );
    url.searchParams.set("per_page", "1");
    if (ref) url.searchParams.set("branch", ref);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const message = text || res.statusText || "GitHub status fetch failed";
      return c.json({ ok: false, status: res.status, message }, 502);
    }

    const json = (await res.json()) as any;
    const run = Array.isArray(json?.workflow_runs) ? json.workflow_runs[0] : null;
    if (!run) {
      return c.json({ ok: true, run: null });
    }

    return c.json({
      ok: true,
      run: {
        id: run.id,
        html_url: run.html_url,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        updated_at: run.updated_at,
        head_branch: run.head_branch
      }
    });
  });

  app.post("/admin/ci/trigger", requireAdmin, async (c) => {
    let body: TriggerBody = {};
    try {
      body = (await c.req.json()) as TriggerBody;
    } catch {
      // allow empty body
    }

    const token = c.env.GITHUB_CI_TOKEN;
    const owner = c.env.GITHUB_CI_OWNER;
    const repo = c.env.GITHUB_CI_REPO;
    const workflow = c.env.GITHUB_CI_WORKFLOW ?? "deploy.yml";
    const ref = body.ref ?? c.env.GITHUB_CI_REF ?? "main";

    if (!token || !owner || !repo) {
      return c.text("Missing GitHub CI configuration", 400);
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ref })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const message = text || res.statusText || "GitHub dispatch failed";
      return c.json({ ok: false, status: res.status, message }, 502);
    }

    return c.json({ ok: true, ref });
  });
}
