import type { SourcesConfigV1 } from "@app/shared";

const API_BASE = import.meta.env.VITE_API_BASE;

type ApiError = Error & { status: number; body?: string };

type FetchOptions = RequestInit & { parseJson?: boolean };

async function request<T = unknown>(path: string, init?: FetchOptions): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(body || `Request failed: ${res.status}`) as ApiError;
    err.status = res.status;
    err.body = body;
    throw err;
  }

  if (init?.parseJson === false) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export type SecretSummary = { name: string; updatedAt: string };
export type SecretsListResponse = { secrets: SecretSummary[] };
export type SourceTestResponse = { ok: boolean; status: number; message?: string };
export type R2UsageSummary = {
  month: string;
  classA: number;
  classB: number;
  bytesUploaded: number;
  bytesDownloaded: number;
  bytesStored: number;
  updatedAt: string;
};
export type SourceUploadResponse = {
  url: string;
  key: string;
  size: number;
  expiresAt?: string;
  warnings?: string[];
  usage?: R2UsageSummary;
};

export type R2UsageResponse = {
  usage: R2UsageSummary;
  warnings: string[];
  uploads: Array<{
    key: string;
    bytes: number;
    mime?: string;
    scope: "sources" | "tools";
    sourceId?: string;
    expiresAt?: string;
    at: string;
  }>;
  maxUploadBytes: number;
  uploadTtlHours: number;
  deleted: number;
};

export type CiTriggerResponse = { ok: true; ref: string };
export type CiStatusResponse =
  | {
      ok: true;
      run: null;
    }
  | {
      ok: true;
      run: {
        id: number;
        html_url: string;
        status: string;
        conclusion: string | null;
        created_at: string;
        updated_at: string;
        head_branch: string;
      };
    };

export async function getSources(): Promise<SourcesConfigV1> {
  return request<SourcesConfigV1>("/admin/sources");
}

export async function putSources(config: SourcesConfigV1): Promise<SourcesConfigV1> {
  return request<SourcesConfigV1>("/admin/sources", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config)
  });
}

export async function listSecrets(): Promise<SecretsListResponse> {
  return request<SecretsListResponse>("/admin/secrets");
}

export async function putSecret(name: string, value: string): Promise<void> {
  await request<void>(`/admin/secrets/${encodeURIComponent(name)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
    parseJson: false
  });
}

export async function deleteSecret(name: string): Promise<void> {
  await request<void>(`/admin/secrets/${encodeURIComponent(name)}`, {
    method: "DELETE",
    parseJson: false
  });
}

export async function testSource(sourceId: string): Promise<SourceTestResponse> {
  return request<SourceTestResponse>("/admin/sources/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId })
  });
}

export async function uploadSourceZip(form: FormData): Promise<SourceUploadResponse> {
  return request<SourceUploadResponse>("/admin/sources/upload", {
    method: "POST",
    body: form
  });
}

export async function getR2Usage(): Promise<R2UsageResponse> {
  return request<R2UsageResponse>("/admin/r2/usage");
}

export async function triggerCiBuild(opts?: { ref?: string; forceRegen?: boolean }): Promise<CiTriggerResponse> {
  return request<CiTriggerResponse>("/admin/ci/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts && (opts.ref || opts.forceRegen) ? opts : {})
  });
}

export async function getCiStatus(ref?: string): Promise<CiStatusResponse> {
  const qs = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return request<CiStatusResponse>(`/admin/ci/status${qs}`);
}

export async function setDefaultTimezone(timezone: string): Promise<{ ok: true; timezone: string }> {
  return request<{ ok: true; timezone: string }>("/admin/settings/timezone", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timezone })
  });
}

export async function setDefaultTimeFormat(format: string): Promise<{ ok: true; format: string }> {
  return request<{ ok: true; format: string }>("/admin/settings/timeformat", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format })
  });
}
