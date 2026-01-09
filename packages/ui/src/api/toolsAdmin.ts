const API_BASE = import.meta.env.VITE_API_BASE;

type FetchOptions = RequestInit & { parseJson?: boolean };

async function request<T = unknown>(path: string, init?: FetchOptions): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `Request failed: ${res.status}`);
  }

  if (init?.parseJson === false) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export type CanvasToLatexResponse = {
  latexByQuizVersionId: Record<string, string>;
  answerKey: Record<string, unknown>;
  warnings: string[];
};

export type LatexToCanvasResponse = {
  zipBase64: string;
  answerKey: Record<string, unknown>;
  warnings: string[];
};

export type UploadResponse = {
  url: string;
  key: string;
  size: number;
  expiresAt?: string;
  warnings?: string[];
  usage?: {
    month: string;
    classA: number;
    classB: number;
    bytesUploaded: number;
    bytesDownloaded: number;
    bytesStored: number;
    updatedAt: string;
  };
};

export type ToolSource =
  | { type: "direct"; url: string; auth?: { kind: "httpHeader"; secretRef: string } }
  | { type: "github"; repo: string; branch: string; path: string; auth?: { kind: "githubToken"; secretRef: string } }
  | { type: "gdrive"; fileId: string; auth?: { kind: "httpHeader"; secretRef: string } };

export type CanvasToLatexRequest = {
  source: ToolSource;
  courseCode?: string;
  subject?: string;
  level?: string;
  versionIndex?: number;
  topicByQuizTitle?: Record<string, string>;
};

export type LatexToCanvasRequest = {
  source: ToolSource;
  quizTitle: string;
  topic: string;
  courseCode?: string;
  subject?: string;
  level?: string;
  versionIndex?: number;
  fillBlankExportMode?: "combined_short_answer" | "split_items";
  combinedDelimiter?: string;
};

export async function canvasZipToLatexTool(body: CanvasToLatexRequest): Promise<CanvasToLatexResponse> {
  return request<CanvasToLatexResponse>("/admin/tools/canvas-to-latex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function latexToCanvasTool(body: LatexToCanvasRequest): Promise<LatexToCanvasResponse> {
  return request<LatexToCanvasResponse>("/admin/tools/latex-to-canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function uploadToolFile(form: FormData): Promise<UploadResponse> {
  return request<UploadResponse>("/admin/tools/upload", {
    method: "POST",
    body: form
  });
}
