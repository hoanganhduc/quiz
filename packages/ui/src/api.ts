import type {
  AnswerValueV1,
  ChoiceKey,
  ExamCompositionItemV1,
  ExamPolicyV1,
  QuestionAnswersV1,
  QuestionPublicV1,
  SubmissionPerQuestionV1
} from "@app/shared";

const API_BASE = import.meta.env.VITE_API_BASE;

if (!API_BASE) {
  console.warn("VITE_API_BASE is not set; API calls will fail.");
}

type SessionMeta = {
  roles?: string[];
  displayName?: string;
  providers?: string[];
};

export type SessionUser = SessionMeta & {
  provider: "github" | "google";
  userId: string;
  name: string;
  username?: string;
  email?: string;
};

export type SessionAnon = SessionMeta & {
  provider: "anon";
  anonymousId: string;
};

export type Session = SessionUser | SessionAnon;

type FetchOptions = RequestInit & { parseJson?: boolean };

async function apiFetch<T = unknown>(path: string, init?: FetchOptions): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  if (init?.parseJson === false) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export async function getSession(): Promise<Session | null> {
  const data = await apiFetch<{ session: Session | null }>("/auth/me");
  return data.session;
}

export async function loginGoogle(idToken: string): Promise<SessionUser> {
  const data = await apiFetch<{ ok: true; user: SessionUser }>("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  return data.user;
}

export async function loginAnonymous(): Promise<void> {
  await apiFetch("/auth/anonymous", {
    method: "POST",
    parseJson: false
  });
}

export type ExamConfigResponse = {
  examId: string;
  subject: string;
  title?: string | null;
  composition: ExamCompositionItemV1[];
  policy: ExamPolicyV1;
  expiresAt: string | null;
  auth: Session["provider"] | null;
  visibility: "public" | "private";
};

export async function getExamConfig(examId: string): Promise<ExamConfigResponse> {
  return apiFetch(`/exam/${examId}/config`);
}

export type ExamBankQuestion = QuestionPublicV1 | QuestionAnswersV1;
export type ExamVersionInfo = { versionId: string; versionIndex?: number };

export type ExamBankResponse = { examId?: string; version?: ExamVersionInfo; questions: ExamBankQuestion[] };

export async function getExamBank(examId: string, code?: string): Promise<ExamBankResponse> {
  const url = new URL(`${API_BASE}/exam/${examId}/bank`);
  if (code) url.searchParams.set("code", code);
  const res = await fetch(url.toString(), {
    credentials: "include",
    headers: code ? { "X-Quiz-Code": code } : undefined
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return (await res.json()) as ExamBankResponse;
}

export type SubmitResponse = {
  ok: true;
  submission: {
    submissionId: string;
    score: { correct: number; total: number };
    perQuestion: SubmissionPerQuestionV1[];
    version?: { versionId: string; versionIndex?: number };
  };
};

export async function submitExam(
  examId: string,
  answers: Record<string, AnswerValueV1>,
  code?: string
): Promise<SubmitResponse> {
  return apiFetch(`/exam/${examId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(code ? { "X-Quiz-Code": code } : {}) },
    body: JSON.stringify(code ? { answers, code } : { answers })
  });
}

export function githubLoginUrl(currentUrl: string): string {
  return `${API_BASE}/auth/github/start?redirect=${encodeURIComponent(currentUrl)}`;
}

export function githubLinkUrl(currentUrl: string): string {
  return `${API_BASE}/auth/github/start?mode=link&redirect=${encodeURIComponent(currentUrl)}`;
}

export function googleLoginUrl(currentUrl: string): string {
  const params = new URLSearchParams({ redirect: currentUrl });
  return `${API_BASE}/auth/google/start?${params.toString()}`;
}

export function googleLinkUrl(currentUrl: string): string {
  const params = new URLSearchParams({ mode: "link", redirect: currentUrl });
  return `${API_BASE}/auth/google/start?${params.toString()}`;
}

export type SubmissionSummary = {
  submissionId: string;
  examId: string;
  submittedAt: string;
  score: { correct: number; total: number };
  version?: { versionId: string; versionIndex?: number };
};

export async function getUserSubmissions(cursor?: string): Promise<{ submissions: SubmissionSummary[]; nextCursor?: string }> {
  const path = cursor ? `/me/submissions?cursor=${encodeURIComponent(cursor)}` : "/me/submissions";
  return apiFetch(path);
}

export type SubmissionDetail = {
  submissionId: string;
  examId: string;
  submittedAt: string;
  score: { correct: number; total: number };
  perQuestion: {
    uid: string;
    chosen: AnswerValueV1;
    correct: boolean;
    answerKey?: ChoiceKey;
    expected?: string[];
    solution?: string;
  }[];
  version?: { versionId: string; versionIndex?: number };
};

export async function getSubmissionDetail(submissionId: string): Promise<SubmissionDetail> {
  return apiFetch(`/me/submissions/${submissionId}`);
}

export type PublicExamSummary = {
  examId: string;
  subject: string;
  createdAt: string;
  expiresAt: string | null;
};

export async function listPublicExams(): Promise<{ items: PublicExamSummary[] }> {
  return apiFetch("/public/exams");
}

export async function resolveShortLink(code: string): Promise<{ examId: string; subject: string }> {
  return apiFetch(`/public/short/${encodeURIComponent(code)}`);
}

export async function getDefaultTimezone(): Promise<string | null> {
  const res = await apiFetch<{ timezone?: string | null }>("/settings/timezone");
  return res.timezone ?? null;
}

export async function getDefaultTimeFormat(): Promise<string | null> {
  const res = await apiFetch<{ format?: string | null }>("/settings/timeformat");
  return res.format ?? null;
}
