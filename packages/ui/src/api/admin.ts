import type { ExamCompositionItemV1, ExamPolicyV1, ExamV1 } from "@app/shared";
import type { BankPublicV1 } from "@app/shared";
import { getSessionToken } from "../api";

export type AdminExamRequest = {
  subject: "discrete-math";
  composition: ExamCompositionItemV1[];
  title?: string;
  seed?: string;
  policy: ExamPolicyV1;
  codes?: string[];
  expiresAt?: string | null;
  visibility?: "public" | "private";
  notice?: string;
};

export type CreateExamResponse = { examId: string; examUrl: string; seed: string };
export type ExamTemplateResponse = {
  examId: string;
  subject: "discrete-math";
  composition: ExamCompositionItemV1[];
  policy: ExamPolicyV1;
  expiresAt: string | null;
  visibility: "public" | "private";
};

export type AdminExamSummary = {
  examId: string;
  subject: "discrete-math";
  createdAt: string;
  updatedAt: string | null;
  deletedAt: string | null;
  expiresAt: string | null;
  visibility: "public" | "private";
  questionCount: number;
  composition: ExamCompositionItemV1[];
  policy: ExamPolicyV1;
  hasSubmissions: boolean;
  title?: string;
  notice?: string;
};

export type ListExamsResponse = { items: AdminExamSummary[]; cursor?: string };

export type AdminExamDetailResponse = { exam: ExamV1; hasSubmissions: boolean };

export type UpdateExamResponse = { examId: string; updatedAt: string; hasSubmissions: boolean };

export type DeleteExamResponse =
  | { examId: string; deletedAt: string }
  | { examId: string; deleted: true; deletedSubmissions: number };

export type ImportExamsResponse = { results: Array<{ examId: string; ok: boolean; error?: string }> };
export type CloneExamResponse = { examId: string; examUrl: string; seed?: string };
export type ExamShortLinkResponse = { code: string; shortUrl: string };

export type ExamTemplateRecord = {
  templateId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  template: {
    subject: "discrete-math";
    composition: ExamCompositionItemV1[];
    policy: ExamPolicyV1;
    codes?: string[];
    expiresAt?: string | null;
    visibility?: "public" | "private";
    notice?: string;
  };
};

export type ListTemplatesResponse = { items: ExamTemplateRecord[]; cursor?: string };
export type ImportTemplatesResponse = { results: Array<{ templateId: string; ok: boolean; error?: string }> };

export type ApiError = {
  status: number;
  message: string;
  body?: unknown;
};

function normalizeBase(apiBase: string): string {
  return apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
}

async function parseError(res: Response): Promise<ApiError> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await res.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message : res.statusText || "Request failed";
    return { status: res.status, message, body };
  }
  const text = await res.text().catch(() => "");
  return { status: res.status, message: text || res.statusText || "Request failed" };
}

async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}

export async function createExam(params: {
  apiBase: string;
  adminToken?: string;
  body: AdminExamRequest;
}): Promise<CreateExamResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams`, {
    method: "POST",
    headers: {
      ...(params.adminToken ? { Authorization: `Bearer ${params.adminToken}` } : {}),
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify(params.body)
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as CreateExamResponse;
}

export async function healthCheck(apiBase: string): Promise<{ ok: true } | { ok: false; error: ApiError }> {
  const base = normalizeBase(apiBase);
  const res = await authFetch(`${base}/health`, { method: "GET" });
  if (!res.ok) {
    return { ok: false, error: await parseError(res) };
  }
  return { ok: true };
}

export async function getExamTemplate(params: { apiBase: string; examId: string }): Promise<ExamTemplateResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/template`, {
    method: "GET",
    credentials: "include"
  });

  if (!res.ok) {
    throw await parseError(res);
  }

  return (await res.json()) as ExamTemplateResponse;
}

export async function listExams(params: {
  apiBase: string;
  includeDeleted?: boolean;
}): Promise<ListExamsResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const url = new URL(`${apiBase}/admin/exams`);
  if (params.includeDeleted) url.searchParams.set("includeDeleted", "1");
  const res = await authFetch(url.toString(), { credentials: "include" });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as ListExamsResponse;
}

export async function getAdminExam(params: { apiBase: string; examId: string }): Promise<AdminExamDetailResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}`, {
    method: "GET",
    credentials: "include"
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as AdminExamDetailResponse;
}

export async function updateExam(params: {
  apiBase: string;
  examId: string;
  body: AdminExamRequest;
}): Promise<UpdateExamResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params.body)
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as UpdateExamResponse;
}

export async function deleteExam(params: {
  apiBase: string;
  examId: string;
  mode: "soft" | "hard";
}): Promise<DeleteExamResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ mode: params.mode })
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as DeleteExamResponse;
}

export async function restoreExam(params: { apiBase: string; examId: string }): Promise<{ examId: string; restoredAt: string }> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/restore`, {
    method: "POST",
    credentials: "include"
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as { examId: string; restoredAt: string };
}

export async function importExams(params: {
  apiBase: string;
  items: ExamV1[];
  mode?: "overwrite";
}): Promise<ImportExamsResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items: params.items, mode: params.mode })
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as ImportExamsResponse;
}

export async function cloneExam(params: { apiBase: string; examId: string }): Promise<CloneExamResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/clone`, {
    method: "POST",
    credentials: "include"
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as CloneExamResponse;
}

export async function createExamShortLink(params: { apiBase: string; examId: string }): Promise<ExamShortLinkResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/exams/${encodeURIComponent(params.examId)}/shortlink`, {
    method: "POST",
    credentials: "include"
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as ExamShortLinkResponse;
}

export async function listTemplates(params: { apiBase: string }): Promise<ListTemplatesResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/templates`, { credentials: "include" });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as ListTemplatesResponse;
}

export async function createTemplate(params: {
  apiBase: string;
  name: string;
  template: ExamTemplateRecord["template"];
}): Promise<ExamTemplateRecord> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: params.name, template: params.template })
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as ExamTemplateRecord;
}

export async function updateTemplate(params: {
  apiBase: string;
  templateId: string;
  name: string;
  template: ExamTemplateRecord["template"];
}): Promise<ExamTemplateRecord> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/templates/${encodeURIComponent(params.templateId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name: params.name, template: params.template })
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as ExamTemplateRecord;
}

export async function deleteTemplate(params: { apiBase: string; templateId: string }): Promise<void> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/templates/${encodeURIComponent(params.templateId)}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!res.ok) {
    throw await parseError(res);
  }
}

export async function importTemplates(params: {
  apiBase: string;
  items: Array<{ name: string; template: ExamTemplateRecord["template"] }>;
}): Promise<ImportTemplatesResponse> {
  const apiBase = normalizeBase(params.apiBase);
  const res = await authFetch(`${apiBase}/admin/templates/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items: params.items })
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as ImportTemplatesResponse;
}

export type BanksListResponse = { subjects: string[] };

export async function listAvailableBanks(apiBase: string): Promise<BanksListResponse> {
  const base = normalizeBase(apiBase);
  const res = await authFetch(`${base}/admin/banks`, { credentials: "include" });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as BanksListResponse;
}

export async function getLatestPublicBank(apiBase: string, subject: string): Promise<BankPublicV1> {
  const base = normalizeBase(apiBase);
  const res = await authFetch(`${base}/admin/banks/${encodeURIComponent(subject)}/public`, { credentials: "include" });
  if (!res.ok) {
    throw await parseError(res);
  }
  return (await res.json()) as BankPublicV1;
}
