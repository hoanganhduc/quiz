import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { Alert } from "../../components/ui/Alert";
import {
  canvasZipToLatexTool,
  latexToCanvasTool,
  uploadToolFile,
  type CanvasToLatexResponse,
  type LatexToCanvasResponse
} from "../../api/toolsAdmin";

type Notice = { tone: "success" | "error" | "warn" | "info"; text: string };
type ToolSourceType = "direct" | "github" | "gdrive" | "upload";

function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function base64ToBlob(base64: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function ExtraToolsPage() {
  const [notice, setNotice] = useState<Notice | null>(null);

  const [canvasSourceType, setCanvasSourceType] = useState<ToolSourceType>("direct");
  const [canvasUrl, setCanvasUrl] = useState("");
  const [canvasRepo, setCanvasRepo] = useState("");
  const [canvasBranch, setCanvasBranch] = useState("main");
  const [canvasPath, setCanvasPath] = useState("");
  const [canvasDriveFileId, setCanvasDriveFileId] = useState("");
  const [canvasSecretRef, setCanvasSecretRef] = useState("");
  const [canvasUploadFile, setCanvasUploadFile] = useState<File | null>(null);
  const [canvasUploadUrl, setCanvasUploadUrl] = useState("");
  const [canvasUploading, setCanvasUploading] = useState(false);
  const [canvasCourse, setCanvasCourse] = useState("MAT3500");
  const [canvasSubject, setCanvasSubject] = useState("discrete-math");
  const [canvasLevel, setCanvasLevel] = useState("basic");
  const [canvasVersionIndex, setCanvasVersionIndex] = useState("0");
  const [topicByTitle, setTopicByTitle] = useState("");
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasResult, setCanvasResult] = useState<CanvasToLatexResponse | null>(null);

  const [latexSourceType, setLatexSourceType] = useState<ToolSourceType>("direct");
  const [latexUrl, setLatexUrl] = useState("");
  const [latexRepo, setLatexRepo] = useState("");
  const [latexBranch, setLatexBranch] = useState("main");
  const [latexPath, setLatexPath] = useState("");
  const [latexDriveFileId, setLatexDriveFileId] = useState("");
  const [latexSecretRef, setLatexSecretRef] = useState("");
  const [latexUploadFile, setLatexUploadFile] = useState<File | null>(null);
  const [latexUploadUrl, setLatexUploadUrl] = useState("");
  const [latexUploading, setLatexUploading] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [latexCourse, setLatexCourse] = useState("MAT3500");
  const [latexSubject, setLatexSubject] = useState("discrete-math");
  const [latexLevel, setLatexLevel] = useState("basic");
  const [latexVersionIndex, setLatexVersionIndex] = useState("0");
  const [fillBlankExportMode, setFillBlankExportMode] = useState("combined_short_answer");
  const [combinedDelimiter, setCombinedDelimiter] = useState("; ");
  const [latexLoading, setLatexLoading] = useState(false);
  const [latexResult, setLatexResult] = useState<LatexToCanvasResponse | null>(null);
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!latexResult?.zipBase64) {
      if (zipUrl) URL.revokeObjectURL(zipUrl);
      setZipUrl(null);
      return;
    }
    const blob = base64ToBlob(latexResult.zipBase64, "application/zip");
    const url = URL.createObjectURL(blob);
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    setZipUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [latexResult]);

  const canvasWarnings = useMemo(() => canvasResult?.warnings ?? [], [canvasResult]);
  const latexWarnings = useMemo(() => latexResult?.warnings ?? [], [latexResult]);

  const uploadCanvasZip = async () => {
    if (!canvasUploadFile) {
      setNotice({ tone: "error", text: "Choose a zip file to upload." });
      return;
    }
    setCanvasUploading(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", canvasUploadFile);
      const res = await uploadToolFile(form);
      setCanvasUploadUrl(res.url);
      if (res.warnings && res.warnings.length > 0) {
        setNotice({ tone: "warn", text: res.warnings.join(" ") });
      } else {
        setNotice({ tone: "success", text: "Uploaded zip to R2." });
      }
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Upload failed." });
    } finally {
      setCanvasUploading(false);
    }
  };

  const uploadLatexFile = async () => {
    if (!latexUploadFile) {
      setNotice({ tone: "error", text: "Choose a .tex file to upload." });
      return;
    }
    setLatexUploading(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", latexUploadFile);
      const res = await uploadToolFile(form);
      setLatexUploadUrl(res.url);
      if (res.warnings && res.warnings.length > 0) {
        setNotice({ tone: "warn", text: res.warnings.join(" ") });
      } else {
        setNotice({ tone: "success", text: "Uploaded .tex to R2." });
      }
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Upload failed." });
    } finally {
      setLatexUploading(false);
    }
  };

  const runCanvasToLatex = async () => {
    const secretRef = canvasSecretRef.trim();
    let source: { type: "direct"; url: string; auth?: { kind: "httpHeader"; secretRef: string } }
      | { type: "github"; repo: string; branch: string; path: string; auth?: { kind: "githubToken"; secretRef: string } }
      | { type: "gdrive"; fileId: string; auth?: { kind: "httpHeader"; secretRef: string } };

    if (canvasSourceType === "upload") {
      if (!canvasUploadUrl) {
        setNotice({ tone: "error", text: "Upload a zip file first." });
        return;
      }
      source = { type: "direct", url: canvasUploadUrl };
    } else if (canvasSourceType === "direct") {
      const url = canvasUrl.trim();
      if (!url) {
        setNotice({ tone: "error", text: "Provide a direct HTTPS link to a Canvas IMS-CC zip." });
        return;
      }
      if (!url.startsWith("https://")) {
        setNotice({ tone: "error", text: "Direct link must start with https://." });
        return;
      }
      source = { type: "direct", url, auth: secretRef ? { kind: "httpHeader", secretRef } : undefined };
    } else if (canvasSourceType === "github") {
      const repo = canvasRepo.trim();
      const branch = canvasBranch.trim();
      const path = canvasPath.trim().replace(/^\/+/, "");
      if (!repo || !branch || !path) {
        setNotice({ tone: "error", text: "Provide repo, branch, and file path." });
        return;
      }
      source = {
        type: "github",
        repo,
        branch,
        path,
        auth: secretRef ? { kind: "githubToken", secretRef } : undefined
      };
    } else {
      const fileId = canvasDriveFileId.trim();
      if (!fileId) {
        setNotice({ tone: "error", text: "Provide a Google Drive fileId." });
        return;
      }
      source = { type: "gdrive", fileId, auth: secretRef ? { kind: "httpHeader", secretRef } : undefined };
    }

    setNotice(null);
    setCanvasLoading(true);
    setCanvasResult(null);
    let topicMap: Record<string, string> | undefined;
    if (topicByTitle.trim()) {
      try {
        topicMap = JSON.parse(topicByTitle);
      } catch {
        setNotice({ tone: "error", text: "topicByQuizTitle must be valid JSON." });
        setCanvasLoading(false);
        return;
      }
    }
    try {
      const res = await canvasZipToLatexTool({
        source,
        courseCode: canvasCourse,
        subject: canvasSubject,
        level: canvasLevel,
        versionIndex: Number.isFinite(Number(canvasVersionIndex)) ? Number(canvasVersionIndex) : undefined,
        topicByQuizTitle: topicMap
      });
      setCanvasResult(res);
      setNotice({ tone: "success", text: "Canvas zip converted to LaTeX." });
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Conversion failed." });
    } finally {
      setCanvasLoading(false);
    }
  };

  const runLatexToCanvas = async () => {
    if (!quizTitle.trim() || !topic.trim()) {
      setNotice({ tone: "error", text: "Quiz title and topic are required." });
      return;
    }

    const secretRef = latexSecretRef.trim();
    let source: { type: "direct"; url: string; auth?: { kind: "httpHeader"; secretRef: string } }
      | { type: "github"; repo: string; branch: string; path: string; auth?: { kind: "githubToken"; secretRef: string } }
      | { type: "gdrive"; fileId: string; auth?: { kind: "httpHeader"; secretRef: string } };

    if (latexSourceType === "upload") {
      if (!latexUploadUrl) {
        setNotice({ tone: "error", text: "Upload a .tex file first." });
        return;
      }
      source = { type: "direct", url: latexUploadUrl };
    } else if (latexSourceType === "direct") {
      const url = latexUrl.trim();
      if (!url) {
        setNotice({ tone: "error", text: "Provide a direct HTTPS link to a .tex file." });
        return;
      }
      if (!url.startsWith("https://")) {
        setNotice({ tone: "error", text: "Direct link must start with https://." });
        return;
      }
      source = { type: "direct", url, auth: secretRef ? { kind: "httpHeader", secretRef } : undefined };
    } else if (latexSourceType === "github") {
      const repo = latexRepo.trim();
      const branch = latexBranch.trim();
      const path = latexPath.trim().replace(/^\/+/, "");
      if (!repo || !branch || !path) {
        setNotice({ tone: "error", text: "Provide repo, branch, and file path." });
        return;
      }
      source = {
        type: "github",
        repo,
        branch,
        path,
        auth: secretRef ? { kind: "githubToken", secretRef } : undefined
      };
    } else {
      const fileId = latexDriveFileId.trim();
      if (!fileId) {
        setNotice({ tone: "error", text: "Provide a Google Drive fileId." });
        return;
      }
      source = { type: "gdrive", fileId, auth: secretRef ? { kind: "httpHeader", secretRef } : undefined };
    }

    setNotice(null);
    setLatexLoading(true);
    setLatexResult(null);
    try {
      const res = await latexToCanvasTool({
        source,
        quizTitle: quizTitle.trim(),
        topic: topic.trim(),
        courseCode: latexCourse,
        subject: latexSubject,
        level: latexLevel,
        versionIndex: Number.isFinite(Number(latexVersionIndex)) ? Number(latexVersionIndex) : undefined,
        fillBlankExportMode: fillBlankExportMode as "combined_short_answer" | "split_items",
        combinedDelimiter
      });
      setLatexResult(res);
      setNotice({ tone: "success", text: "LaTeX converted to Canvas IMS-CC zip." });
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Conversion failed." });
    } finally {
      setLatexLoading(false);
    }
  };

  return (
    <AdminAuthGate>
      <PageShell maxWidth="5xl" className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-text">Extra Tools</h1>
          <p className="text-sm text-textMuted">Convert Canvas IMS-CC and LaTeX question banks without leaving the admin UI.</p>
        </div>

        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text">Canvas → LaTeX</h2>
              <p className="text-sm text-textMuted">Fetch a Canvas IMS-CC zip from GitHub, Google Drive, or a direct link.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text" htmlFor="canvas-source-type">
                Source type
              </label>
              <Select
                id="canvas-source-type"
                value={canvasSourceType}
                onChange={(e) => setCanvasSourceType(e.target.value as ToolSourceType)}
              >
                <option value="direct">Direct link to ZIP</option>
                <option value="upload">Upload</option>
                <option value="github">GitHub repo file</option>
                <option value="gdrive">Google Drive file</option>
              </Select>
            </div>

            {canvasSourceType === "upload" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="canvas-upload">
                  Upload zip
                </label>
                <Input
                  id="canvas-upload"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => {
                    setCanvasUploadFile(e.target.files?.[0] ?? null);
                    setCanvasUploadUrl("");
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={uploadCanvasZip} disabled={canvasUploading}>
                    {canvasUploading ? "Uploading…" : "Upload"}
                  </Button>
                  {canvasUploadUrl ? <span className="text-xs text-textMuted">Uploaded</span> : null}
                </div>
              </div>
            ) : canvasSourceType === "direct" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="canvas-url">
                  ZIP url
                </label>
                <Input
                  id="canvas-url"
                  value={canvasUrl}
                  onChange={(e) => setCanvasUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ) : canvasSourceType === "github" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text" htmlFor="canvas-repo">
                    repo
                  </label>
                  <Input
                    id="canvas-repo"
                    value={canvasRepo}
                    onChange={(e) => setCanvasRepo(e.target.value)}
                    placeholder="owner/repo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text" htmlFor="canvas-branch">
                    branch
                  </label>
                  <Input
                    id="canvas-branch"
                    value={canvasBranch}
                    onChange={(e) => setCanvasBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium text-text" htmlFor="canvas-path">
                    file path
                  </label>
                  <Input
                    id="canvas-path"
                    value={canvasPath}
                    onChange={(e) => setCanvasPath(e.target.value)}
                    placeholder="path/to/quiz.zip"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="canvas-drive">
                  Google Drive fileId
                </label>
                <Input
                  id="canvas-drive"
                  value={canvasDriveFileId}
                  onChange={(e) => setCanvasDriveFileId(e.target.value)}
                  placeholder="Drive fileId"
                />
              </div>
            )}

            {canvasSourceType === "upload" ? null : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text" htmlFor="canvas-secret-ref">
                auth secretRef (optional)
              </label>
              <Input
                id="canvas-secret-ref"
                value={canvasSecretRef}
                onChange={(e) => setCanvasSecretRef(e.target.value)}
                placeholder={canvasSourceType === "github" ? "github_token_secret" : "http_header_secret"}
              />
              <p className="text-xs text-textMuted">
                {canvasSourceType === "github"
                  ? "Use a secret containing a GitHub token."
                  : "Use a secret containing a full HTTP header line, e.g. Authorization: Bearer <TOKEN>."}
              </p>
            </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="canvas-course">
                  courseCode
                </label>
                <Input id="canvas-course" value={canvasCourse} onChange={(e) => setCanvasCourse(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="canvas-subject">
                  subject
                </label>
                <Input id="canvas-subject" value={canvasSubject} onChange={(e) => setCanvasSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="canvas-level">
                  level
                </label>
                <Input id="canvas-level" value={canvasLevel} onChange={(e) => setCanvasLevel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="canvas-version">
                  versionIndex
                </label>
                <Input id="canvas-version" value={canvasVersionIndex} onChange={(e) => setCanvasVersionIndex(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text" htmlFor="topic-map">
                topicByQuizTitle (JSON, optional)
              </label>
              <Textarea
                id="topic-map"
                rows={3}
                placeholder='{"Quiz A":"graph","Quiz B":"probability"}'
                value={topicByTitle}
                onChange={(e) => setTopicByTitle(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={runCanvasToLatex} disabled={canvasLoading}>
                {canvasLoading ? "Converting…" : "Convert to LaTeX"}
              </Button>
              {canvasResult ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => downloadText("answerKey.canvas.json", JSON.stringify(canvasResult.answerKey, null, 2))}
                >
                  Download AnswerKey
                </Button>
              ) : null}
              {canvasWarnings.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => downloadText("warnings.canvas.txt", canvasWarnings.join("\n"))}
                >
                  Download warnings
                </Button>
              ) : null}
            </div>

            {canvasResult ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-text">LaTeX outputs</div>
                <div className="space-y-1 text-sm">
                  {Object.entries(canvasResult.latexByQuizVersionId).map(([versionId, latex]) => {
                    const safeName = versionId.replace(/[^A-Za-z0-9._-]+/g, "_");
                    return (
                    <div key={versionId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs text-textMuted">versionId</div>
                        <div className="font-mono text-xs truncate">{versionId}</div>
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={() => downloadText(`${safeName}.tex`, latex)}>
                        Download
                      </Button>
                    </div>
                  )})}
                </div>
              </div>
            ) : null}

            {canvasWarnings.length > 0 ? (
              <Alert tone="warn">
                {canvasWarnings.slice(0, 4).map((w) => (
                  <div key={w}>{w}</div>
                ))}
                {canvasWarnings.length > 4 ? <div>…and {canvasWarnings.length - 4} more</div> : null}
              </Alert>
            ) : null}
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-text">LaTeX → Canvas</h2>
              <p className="text-sm text-textMuted">Fetch a LaTeX .tex file from GitHub, Google Drive, or a direct link.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text" htmlFor="latex-source-type">
                Source type
              </label>
              <Select
                id="latex-source-type"
                value={latexSourceType}
                onChange={(e) => setLatexSourceType(e.target.value as ToolSourceType)}
              >
                <option value="direct">Direct link to .tex</option>
                <option value="upload">Upload</option>
                <option value="github">GitHub repo file</option>
                <option value="gdrive">Google Drive file</option>
              </Select>
            </div>

            {latexSourceType === "upload" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="latex-upload">
                  Upload .tex
                </label>
                <Input
                  id="latex-upload"
                  type="file"
                  accept=".tex,text/plain"
                  onChange={(e) => {
                    setLatexUploadFile(e.target.files?.[0] ?? null);
                    setLatexUploadUrl("");
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={uploadLatexFile} disabled={latexUploading}>
                    {latexUploading ? "Uploading…" : "Upload"}
                  </Button>
                  {latexUploadUrl ? <span className="text-xs text-textMuted">Uploaded</span> : null}
                </div>
              </div>
            ) : latexSourceType === "direct" ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="latex-url">
                  .tex url
                </label>
                <Input
                  id="latex-url"
                  value={latexUrl}
                  onChange={(e) => setLatexUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            ) : latexSourceType === "github" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text" htmlFor="latex-repo">
                    repo
                  </label>
                  <Input
                    id="latex-repo"
                    value={latexRepo}
                    onChange={(e) => setLatexRepo(e.target.value)}
                    placeholder="owner/repo"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text" htmlFor="latex-branch">
                    branch
                  </label>
                  <Input
                    id="latex-branch"
                    value={latexBranch}
                    onChange={(e) => setLatexBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium text-text" htmlFor="latex-path">
                    file path
                  </label>
                  <Input
                    id="latex-path"
                    value={latexPath}
                    onChange={(e) => setLatexPath(e.target.value)}
                    placeholder="path/to/questions.tex"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-text" htmlFor="latex-drive">
                  Google Drive fileId
                </label>
                <Input
                  id="latex-drive"
                  value={latexDriveFileId}
                  onChange={(e) => setLatexDriveFileId(e.target.value)}
                  placeholder="Drive fileId"
                />
              </div>
            )}

            {latexSourceType === "upload" ? null : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text" htmlFor="latex-secret-ref">
                auth secretRef (optional)
              </label>
              <Input
                id="latex-secret-ref"
                value={latexSecretRef}
                onChange={(e) => setLatexSecretRef(e.target.value)}
                placeholder={latexSourceType === "github" ? "github_token_secret" : "http_header_secret"}
              />
              <p className="text-xs text-textMuted">
                {latexSourceType === "github"
                  ? "Use a secret containing a GitHub token."
                  : "Use a secret containing a full HTTP header line, e.g. Authorization: Bearer <TOKEN>."}
              </p>
            </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="quiz-title">
                  quizTitle
                </label>
                <Input id="quiz-title" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="topic">
                  topic
                </label>
                <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="latex-course">
                  courseCode
                </label>
                <Input id="latex-course" value={latexCourse} onChange={(e) => setLatexCourse(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="latex-subject">
                  subject
                </label>
                <Input id="latex-subject" value={latexSubject} onChange={(e) => setLatexSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="latex-level">
                  level
                </label>
                <Input id="latex-level" value={latexLevel} onChange={(e) => setLatexLevel(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="latex-version">
                  versionIndex
                </label>
                <Input id="latex-version" value={latexVersionIndex} onChange={(e) => setLatexVersionIndex(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="fill-blank-mode">
                  fillBlankExportMode
                </label>
                <Select
                  id="fill-blank-mode"
                  value={fillBlankExportMode}
                  onChange={(e) => setFillBlankExportMode(e.target.value)}
                >
                  <option value="combined_short_answer">combined_short_answer</option>
                  <option value="split_items">split_items</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-text" htmlFor="combined-delimiter">
                  combinedDelimiter
                </label>
                <Input
                  id="combined-delimiter"
                  value={combinedDelimiter}
                  onChange={(e) => setCombinedDelimiter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={runLatexToCanvas} disabled={latexLoading}>
                {latexLoading ? "Converting…" : "Convert to Canvas zip"}
              </Button>
              {zipUrl ? (
                <Button type="button" variant="secondary" onClick={() => {
                  const a = document.createElement("a");
                  a.href = zipUrl;
                  a.download = "canvas-export.zip";
                  a.click();
                }}>
                  Download zip
                </Button>
              ) : null}
              {latexResult ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => downloadText("answerKey.latex.json", JSON.stringify(latexResult.answerKey, null, 2))}
                >
                  Download AnswerKey
                </Button>
              ) : null}
              {latexWarnings.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => downloadText("warnings.latex.txt", latexWarnings.join("\n"))}
                >
                  Download warnings
                </Button>
              ) : null}
            </div>

            {latexWarnings.length > 0 ? (
              <Alert tone="warn">
                {latexWarnings.slice(0, 4).map((w) => (
                  <div key={w}>{w}</div>
                ))}
                {latexWarnings.length > 4 ? <div>…and {latexWarnings.length - 4} more</div> : null}
              </Alert>
            ) : null}
          </Card>
        </div>
      </PageShell>
    </AdminAuthGate>
  );
}
