import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Textarea } from "../../components/ui/Textarea";
import { Alert } from "../../components/ui/Alert";
import { canvasZipToLatexTool, latexToCanvasTool, uploadToolFile } from "../../api/toolsAdmin";
function downloadText(filename, contents) {
    const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
function base64ToBlob(base64, mime) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}
export function ExtraToolsPage() {
    const [notice, setNotice] = useState(null);
    const [canvasSourceType, setCanvasSourceType] = useState("direct");
    const [canvasUrl, setCanvasUrl] = useState("");
    const [canvasRepo, setCanvasRepo] = useState("");
    const [canvasBranch, setCanvasBranch] = useState("main");
    const [canvasPath, setCanvasPath] = useState("");
    const [canvasDriveFileId, setCanvasDriveFileId] = useState("");
    const [canvasSecretRef, setCanvasSecretRef] = useState("");
    const [canvasUploadFile, setCanvasUploadFile] = useState(null);
    const [canvasUploadUrl, setCanvasUploadUrl] = useState("");
    const [canvasUploading, setCanvasUploading] = useState(false);
    const [canvasCourse, setCanvasCourse] = useState("MAT3500");
    const [canvasSubject, setCanvasSubject] = useState("discrete-math");
    const [canvasLevel, setCanvasLevel] = useState("basic");
    const [canvasVersionIndex, setCanvasVersionIndex] = useState("0");
    const [topicByTitle, setTopicByTitle] = useState("");
    const [canvasLoading, setCanvasLoading] = useState(false);
    const [canvasResult, setCanvasResult] = useState(null);
    const [latexSourceType, setLatexSourceType] = useState("direct");
    const [latexUrl, setLatexUrl] = useState("");
    const [latexRepo, setLatexRepo] = useState("");
    const [latexBranch, setLatexBranch] = useState("main");
    const [latexPath, setLatexPath] = useState("");
    const [latexDriveFileId, setLatexDriveFileId] = useState("");
    const [latexSecretRef, setLatexSecretRef] = useState("");
    const [latexUploadFile, setLatexUploadFile] = useState(null);
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
    const [latexResult, setLatexResult] = useState(null);
    const [zipUrl, setZipUrl] = useState(null);
    useEffect(() => {
        if (!latexResult?.zipBase64) {
            if (zipUrl)
                URL.revokeObjectURL(zipUrl);
            setZipUrl(null);
            return;
        }
        const blob = base64ToBlob(latexResult.zipBase64, "application/zip");
        const url = URL.createObjectURL(blob);
        if (zipUrl)
            URL.revokeObjectURL(zipUrl);
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
            }
            else {
                setNotice({ tone: "success", text: "Uploaded zip to R2." });
            }
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Upload failed." });
        }
        finally {
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
            }
            else {
                setNotice({ tone: "success", text: "Uploaded .tex to R2." });
            }
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Upload failed." });
        }
        finally {
            setLatexUploading(false);
        }
    };
    const runCanvasToLatex = async () => {
        const secretRef = canvasSecretRef.trim();
        let source;
        if (canvasSourceType === "upload") {
            if (!canvasUploadUrl) {
                setNotice({ tone: "error", text: "Upload a zip file first." });
                return;
            }
            source = { type: "direct", url: canvasUploadUrl };
        }
        else if (canvasSourceType === "direct") {
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
        }
        else if (canvasSourceType === "github") {
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
        }
        else {
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
        let topicMap;
        if (topicByTitle.trim()) {
            try {
                topicMap = JSON.parse(topicByTitle);
            }
            catch {
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
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Conversion failed." });
        }
        finally {
            setCanvasLoading(false);
        }
    };
    const runLatexToCanvas = async () => {
        if (!quizTitle.trim() || !topic.trim()) {
            setNotice({ tone: "error", text: "Quiz title and topic are required." });
            return;
        }
        const secretRef = latexSecretRef.trim();
        let source;
        if (latexSourceType === "upload") {
            if (!latexUploadUrl) {
                setNotice({ tone: "error", text: "Upload a .tex file first." });
                return;
            }
            source = { type: "direct", url: latexUploadUrl };
        }
        else if (latexSourceType === "direct") {
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
        }
        else if (latexSourceType === "github") {
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
        }
        else {
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
                fillBlankExportMode: fillBlankExportMode,
                combinedDelimiter
            });
            setLatexResult(res);
            setNotice({ tone: "success", text: "LaTeX converted to Canvas IMS-CC zip." });
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Conversion failed." });
        }
        finally {
            setLatexLoading(false);
        }
    };
    return (_jsx(AdminAuthGate, { children: _jsxs(PageShell, { maxWidth: "6xl", className: "space-y-6", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h1", { className: "text-2xl font-semibold text-text", children: "Extra Tools" }), _jsx("p", { className: "text-sm text-textMuted", children: "Convert Canvas IMS-CC and LaTeX question banks without leaving the admin UI." })] }), notice ? _jsx(Alert, { tone: notice.tone, children: notice.text }) : null, _jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Canvas \u2192 LaTeX" }), _jsx("p", { className: "text-sm text-textMuted", children: "Fetch a Canvas IMS-CC zip from GitHub, Google Drive, or a direct link." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-source-type", children: "Source type" }), _jsxs(Select, { id: "canvas-source-type", value: canvasSourceType, onChange: (e) => setCanvasSourceType(e.target.value), children: [_jsx("option", { value: "direct", children: "Direct link to ZIP" }), _jsx("option", { value: "upload", children: "Upload" }), _jsx("option", { value: "github", children: "GitHub repo file" }), _jsx("option", { value: "gdrive", children: "Google Drive file" })] })] }), canvasSourceType === "upload" ? (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-upload", children: "Upload zip" }), _jsx(Input, { id: "canvas-upload", type: "file", accept: ".zip,application/zip", onChange: (e) => {
                                                setCanvasUploadFile(e.target.files?.[0] ?? null);
                                                setCanvasUploadUrl("");
                                            } }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: uploadCanvasZip, disabled: canvasUploading, children: canvasUploading ? "Uploading…" : "Upload" }), canvasUploadUrl ? _jsx("span", { className: "text-xs text-textMuted", children: "Uploaded" }) : null] })] })) : canvasSourceType === "direct" ? (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-url", children: "ZIP url" }), _jsx(Input, { id: "canvas-url", value: canvasUrl, onChange: (e) => setCanvasUrl(e.target.value), placeholder: "https://..." })] })) : canvasSourceType === "github" ? (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-repo", children: "repo" }), _jsx(Input, { id: "canvas-repo", value: canvasRepo, onChange: (e) => setCanvasRepo(e.target.value), placeholder: "owner/repo" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-branch", children: "branch" }), _jsx(Input, { id: "canvas-branch", value: canvasBranch, onChange: (e) => setCanvasBranch(e.target.value), placeholder: "main" })] }), _jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-path", children: "file path" }), _jsx(Input, { id: "canvas-path", value: canvasPath, onChange: (e) => setCanvasPath(e.target.value), placeholder: "path/to/quiz.zip" })] })] })) : (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-drive", children: "Google Drive fileId" }), _jsx(Input, { id: "canvas-drive", value: canvasDriveFileId, onChange: (e) => setCanvasDriveFileId(e.target.value), placeholder: "Drive fileId" })] })), canvasSourceType === "upload" ? null : (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-secret-ref", children: "auth secretRef (optional)" }), _jsx(Input, { id: "canvas-secret-ref", value: canvasSecretRef, onChange: (e) => setCanvasSecretRef(e.target.value), placeholder: canvasSourceType === "github" ? "github_token_secret" : "http_header_secret" }), _jsx("p", { className: "text-xs text-textMuted", children: canvasSourceType === "github"
                                                ? "Use a secret containing a GitHub token."
                                                : "Use a secret containing a full HTTP header line, e.g. Authorization: Bearer <TOKEN>." })] })), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-course", children: "courseCode" }), _jsx(Input, { id: "canvas-course", value: canvasCourse, onChange: (e) => setCanvasCourse(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-subject", children: "subject" }), _jsx(Input, { id: "canvas-subject", value: canvasSubject, onChange: (e) => setCanvasSubject(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-level", children: "level" }), _jsx(Input, { id: "canvas-level", value: canvasLevel, onChange: (e) => setCanvasLevel(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "canvas-version", children: "versionIndex" }), _jsx(Input, { id: "canvas-version", value: canvasVersionIndex, onChange: (e) => setCanvasVersionIndex(e.target.value) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "topic-map", children: "topicByQuizTitle (JSON, optional)" }), _jsx(Textarea, { id: "topic-map", rows: 3, placeholder: '{"Quiz A":"graph","Quiz B":"probability"}', value: topicByTitle, onChange: (e) => setTopicByTitle(e.target.value) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", onClick: runCanvasToLatex, disabled: canvasLoading, children: canvasLoading ? "Converting…" : "Convert to LaTeX" }), canvasResult ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => downloadText("answerKey.canvas.json", JSON.stringify(canvasResult.answerKey, null, 2)), children: "Download AnswerKey" })) : null, canvasWarnings.length > 0 ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => downloadText("warnings.canvas.txt", canvasWarnings.join("\n")), children: "Download warnings" })) : null] }), canvasResult ? (_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "LaTeX outputs" }), _jsx("div", { className: "space-y-1 text-sm", children: Object.entries(canvasResult.latexByQuizVersionId).map(([versionId, latex]) => {
                                                const safeName = versionId.replace(/[^A-Za-z0-9._-]+/g, "_");
                                                return (_jsxs("div", { className: "flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-xs text-textMuted", children: "versionId" }), _jsx("div", { className: "font-mono text-xs truncate", children: versionId })] }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => downloadText(`${safeName}.tex`, latex), children: "Download" })] }, versionId));
                                            }) })] })) : null, canvasWarnings.length > 0 ? (_jsxs(Alert, { tone: "warn", children: [canvasWarnings.slice(0, 4).map((w) => (_jsx("div", { children: w }, w))), canvasWarnings.length > 4 ? _jsxs("div", { children: ["\u2026and ", canvasWarnings.length - 4, " more"] }) : null] })) : null] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "LaTeX \u2192 Canvas" }), _jsx("p", { className: "text-sm text-textMuted", children: "Fetch a LaTeX .tex file from GitHub, Google Drive, or a direct link." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-source-type", children: "Source type" }), _jsxs(Select, { id: "latex-source-type", value: latexSourceType, onChange: (e) => setLatexSourceType(e.target.value), children: [_jsx("option", { value: "direct", children: "Direct link to .tex" }), _jsx("option", { value: "upload", children: "Upload" }), _jsx("option", { value: "github", children: "GitHub repo file" }), _jsx("option", { value: "gdrive", children: "Google Drive file" })] })] }), latexSourceType === "upload" ? (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-upload", children: "Upload .tex" }), _jsx(Input, { id: "latex-upload", type: "file", accept: ".tex,text/plain", onChange: (e) => {
                                                setLatexUploadFile(e.target.files?.[0] ?? null);
                                                setLatexUploadUrl("");
                                            } }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: uploadLatexFile, disabled: latexUploading, children: latexUploading ? "Uploading…" : "Upload" }), latexUploadUrl ? _jsx("span", { className: "text-xs text-textMuted", children: "Uploaded" }) : null] })] })) : latexSourceType === "direct" ? (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-url", children: ".tex url" }), _jsx(Input, { id: "latex-url", value: latexUrl, onChange: (e) => setLatexUrl(e.target.value), placeholder: "https://..." })] })) : latexSourceType === "github" ? (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-repo", children: "repo" }), _jsx(Input, { id: "latex-repo", value: latexRepo, onChange: (e) => setLatexRepo(e.target.value), placeholder: "owner/repo" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-branch", children: "branch" }), _jsx(Input, { id: "latex-branch", value: latexBranch, onChange: (e) => setLatexBranch(e.target.value), placeholder: "main" })] }), _jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-path", children: "file path" }), _jsx(Input, { id: "latex-path", value: latexPath, onChange: (e) => setLatexPath(e.target.value), placeholder: "path/to/questions.tex" })] })] })) : (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-drive", children: "Google Drive fileId" }), _jsx(Input, { id: "latex-drive", value: latexDriveFileId, onChange: (e) => setLatexDriveFileId(e.target.value), placeholder: "Drive fileId" })] })), latexSourceType === "upload" ? null : (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-secret-ref", children: "auth secretRef (optional)" }), _jsx(Input, { id: "latex-secret-ref", value: latexSecretRef, onChange: (e) => setLatexSecretRef(e.target.value), placeholder: latexSourceType === "github" ? "github_token_secret" : "http_header_secret" }), _jsx("p", { className: "text-xs text-textMuted", children: latexSourceType === "github"
                                                ? "Use a secret containing a GitHub token."
                                                : "Use a secret containing a full HTTP header line, e.g. Authorization: Bearer <TOKEN>." })] })), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "quiz-title", children: "quizTitle" }), _jsx(Input, { id: "quiz-title", value: quizTitle, onChange: (e) => setQuizTitle(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "topic", children: "topic" }), _jsx(Input, { id: "topic", value: topic, onChange: (e) => setTopic(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-course", children: "courseCode" }), _jsx(Input, { id: "latex-course", value: latexCourse, onChange: (e) => setLatexCourse(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-subject", children: "subject" }), _jsx(Input, { id: "latex-subject", value: latexSubject, onChange: (e) => setLatexSubject(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-level", children: "level" }), _jsx(Input, { id: "latex-level", value: latexLevel, onChange: (e) => setLatexLevel(e.target.value) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "latex-version", children: "versionIndex" }), _jsx(Input, { id: "latex-version", value: latexVersionIndex, onChange: (e) => setLatexVersionIndex(e.target.value) })] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "fill-blank-mode", children: "fillBlankExportMode" }), _jsxs(Select, { id: "fill-blank-mode", value: fillBlankExportMode, onChange: (e) => setFillBlankExportMode(e.target.value), children: [_jsx("option", { value: "combined_short_answer", children: "combined_short_answer" }), _jsx("option", { value: "split_items", children: "split_items" })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "combined-delimiter", children: "combinedDelimiter" }), _jsx(Input, { id: "combined-delimiter", value: combinedDelimiter, onChange: (e) => setCombinedDelimiter(e.target.value) })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", onClick: runLatexToCanvas, disabled: latexLoading, children: latexLoading ? "Converting…" : "Convert to Canvas zip" }), zipUrl ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => {
                                                const a = document.createElement("a");
                                                a.href = zipUrl;
                                                a.download = "canvas-export.zip";
                                                a.click();
                                            }, children: "Download zip" })) : null, latexResult ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => downloadText("answerKey.latex.json", JSON.stringify(latexResult.answerKey, null, 2)), children: "Download AnswerKey" })) : null, latexWarnings.length > 0 ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => downloadText("warnings.latex.txt", latexWarnings.join("\n")), children: "Download warnings" })) : null] }), latexWarnings.length > 0 ? (_jsxs(Alert, { tone: "warn", children: [latexWarnings.slice(0, 4).map((w) => (_jsx("div", { children: w }, w))), latexWarnings.length > 4 ? _jsxs("div", { children: ["\u2026and ", latexWarnings.length - 4, " more"] }) : null] })) : null] })] })] }) }));
}
