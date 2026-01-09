import type { Hono } from "hono";
import type { Env } from "../env";
import { requireAdmin } from "./requireAdmin";
import { deleteSecret, listSecrets, putSecret } from "../secrets/store";

export function registerAdminSecretsRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/admin/secrets", requireAdmin, async (c) => {
    const secrets = await listSecrets(c.env);
    return c.json({ secrets });
  });

  app.put("/admin/secrets/:name", requireAdmin, async (c) => {
    const name = c.req.param("name");
    let body: { value?: string };
    try {
      body = (await c.req.json()) as { value?: string };
    } catch {
      return c.text("Invalid body", 400);
    }

    if (!body.value) {
      return c.text("Missing value", 400);
    }

    try {
      await putSecret(c.env, name, body.value);
      return c.json({ ok: true });
    } catch (err: any) {
      return c.text(err?.message ?? "Failed", 400);
    }
  });

  app.delete("/admin/secrets/:name", requireAdmin, async (c) => {
    const name = c.req.param("name");
    try {
      await deleteSecret(c.env, name);
      return c.json({ ok: true });
    } catch (err: any) {
      return c.text(err?.message ?? "Failed", 400);
    }
  });
}
