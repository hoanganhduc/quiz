export type CorsResult = {
  allowed: boolean;
  headers: Headers;
};

export function corsForRequest(request: Request, allowedOrigin: string): CorsResult {
  const origin = request.headers.get("Origin");
  const headers = new Headers({ Vary: "Origin" });

  if (!origin) {
    return { allowed: true, headers };
  }

  let allowedBase = allowedOrigin;
  try {
    allowedBase = new URL(allowedOrigin).origin;
  } catch {
    // keep allowedOrigin as-is
  }

  if (origin !== allowedOrigin && origin !== allowedBase) {
    return { allowed: false, headers };
  }

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");

  const reqHeaders = request.headers.get("Access-Control-Request-Headers");
  if (reqHeaders) {
    headers.set("Access-Control-Allow-Headers", reqHeaders);
  }

  const reqMethod = request.headers.get("Access-Control-Request-Method");
  headers.set("Access-Control-Allow-Methods", reqMethod ?? "GET,POST,PUT,DELETE,OPTIONS");

  return { allowed: true, headers };
}

export function cookieSettingsForRequest(request: Request): {
  secure: boolean;
  sameSite: "none" | "lax";
} {
  const url = new URL(request.url);
  const isHttps = url.protocol === "https:";
  if (isHttps) {
    return { secure: true, sameSite: "none" };
  }
  return { secure: false, sameSite: "lax" };
}
