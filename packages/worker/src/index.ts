import { Hono } from "hono";
import { registerGithubAuth } from "./auth/github";
import { registerGoogleAuth } from "./auth/google";
import { registerSessionRoutes } from "./auth/me";
import { corsForRequest } from "./cors";
import type { Env } from "./env";
import { registerExamRoutes } from "./exam";
import { registerAdminUserRoutes } from "./admin/users";
import { registerSubmissionRoutes } from "./submissions/routes";
import { registerAdminSourcesRoutes } from "./admin/sources";
import { registerAdminSecretsRoutes } from "./admin/secrets";
import { registerAdminToolsRoutes } from "./admin/tools";
import { registerFilesRoutes } from "./files";
import { registerAdminR2Routes } from "./admin/r2";
import { registerAdminExamRoutes } from "./admin/exams";
import { registerAdminCiRoutes } from "./admin/ci";
import { registerAdminBanksRoutes } from "./admin/banks";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const { allowed, headers } = corsForRequest(c.req.raw, c.env.UI_ORIGIN);
  const headerObj = Object.fromEntries(headers);

  if (c.req.method === "OPTIONS") {
    if (!allowed) {
      return c.text("Forbidden origin", 403, headerObj);
    }
    headers.set("Access-Control-Max-Age", "86400");
    return new Response(null, { status: 204, headers });
  }

  if (!allowed && c.req.header("Origin")) {
    return c.text("Forbidden origin", 403, headerObj);
  }

  await next();
  for (const [key, value] of headers.entries()) {
    c.res.headers.set(key, value);
  }
});

app.get("/health", (c) => c.json({ ok: true }));
registerGithubAuth(app);
registerGoogleAuth(app);
registerSessionRoutes(app);
registerExamRoutes(app);
registerAdminUserRoutes(app);
registerSubmissionRoutes(app);
registerAdminSourcesRoutes(app);
registerAdminSecretsRoutes(app);
registerAdminToolsRoutes(app);
registerAdminExamRoutes(app);
registerAdminCiRoutes(app);
registerAdminBanksRoutes(app);
registerAdminR2Routes(app);
registerFilesRoutes(app);

export default app;

export * from "./kv";
