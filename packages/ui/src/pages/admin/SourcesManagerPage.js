import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Alert } from "../../components/ui/Alert";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { deleteSecret, getSources, listSecrets, putSecret, putSources, testSource } from "../../api/sourcesAdmin";
function formatUpdatedAt(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}
function formatValidationError(err) {
    return err?.message ?? "Invalid configuration";
}
function validateAndNormalizeConfig(cfg) {
    const fail = (path, message) => {
        throw new Error(`${path}: ${message}`);
    };
    const secretRefOk = (val) => /^[a-zA-Z0-9-_]{1,60}$/.test(val);
    const repoOk = (val) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(val);
    const validateRelativeDir = (val, path) => {
        if (!val)
            fail(path, "dir must be relative and cannot contain '..'");
        if (val.startsWith("/"))
            fail(path, "dir must be relative and cannot contain '..'");
        if (val.split("/").some((part) => part === ".."))
            fail(path, "dir must be relative and cannot contain '..'");
    };
    if (cfg.version !== "v1")
        fail("version", "must be v1");
    const courseCode = cfg.courseCode.trim();
    const subject = cfg.subject.trim();
    const uidNamespace = cfg.uidNamespace.trim();
    if (!courseCode)
        fail("courseCode", "Required");
    if (!subject)
        fail("subject", "Required");
    if (!uidNamespace)
        fail("uidNamespace", "Required");
    const ids = new Set();
    const sources = cfg.sources.map((src, index) => {
        const id = src.id.trim();
        if (!id)
            fail(`sources.${index}.id`, "Required");
        if (ids.has(id))
            fail(`sources.${index}.id`, "id must be unique");
        ids.add(id);
        if (src.type === "github") {
            const repo = src.repo?.trim?.() ?? "";
            const branch = src.branch?.trim?.() ?? "";
            const dir = src.dir?.trim?.() ?? "";
            if (!repoOk(repo))
                fail(`sources.${index}.repo`, "repo must be OWNER/REPO");
            if (!branch)
                fail(`sources.${index}.branch`, "Required");
            validateRelativeDir(dir, `sources.${index}.dir`);
            const auth = src.auth;
            if (auth) {
                if (auth.kind !== "githubToken")
                    fail(`sources.${index}.auth.kind`, "Invalid kind");
                const ref = (auth.secretRef ?? "").trim();
                if (!secretRefOk(ref)) {
                    fail(`sources.${index}.auth.secretRef`, "secretRef must be alphanumeric with dashes/underscores (max 60 chars)");
                }
                return { id, type: "github", repo, branch, dir, auth: { kind: "githubToken", secretRef: ref } };
            }
            return { id, type: "github", repo, branch, dir };
        }
        if (src.type === "gdrive") {
            const folderId = src.folderId?.trim?.() ?? "";
            if (!folderId)
                fail(`sources.${index}.folderId`, "Required");
            if (!/^[A-Za-z0-9_-]{5,}$/.test(folderId)) {
                fail(`sources.${index}.folderId`, "folderId must be alphanumeric with dashes/underscores");
            }
            const auth = src.auth;
            if (auth) {
                if (auth.kind !== "httpHeader")
                    fail(`sources.${index}.auth.kind`, "Invalid kind");
                const ref = (auth.secretRef ?? "").trim();
                if (!secretRefOk(ref)) {
                    fail(`sources.${index}.auth.secretRef`, "secretRef must be alphanumeric with dashes/underscores (max 60 chars)");
                }
                return { id, type: "gdrive", folderId, auth: { kind: "httpHeader", secretRef: ref } };
            }
            return { id, type: "gdrive", folderId };
        }
        // zip
        const url = src.url?.trim?.() ?? "";
        if (!url)
            fail(`sources.${index}.url`, "Required");
        if (!url.startsWith("https://"))
            fail(`sources.${index}.url`, "url must use https");
        try {
            // eslint-disable-next-line no-new
            new URL(url);
        }
        catch {
            fail(`sources.${index}.url`, "Invalid url");
        }
        const dirRaw = src.dir;
        const dirTrimmed = typeof dirRaw === "string" ? dirRaw.trim() : "";
        if (dirRaw !== undefined) {
            if (!dirTrimmed)
                fail(`sources.${index}.dir`, "dir must be relative and cannot contain '..'");
            validateRelativeDir(dirTrimmed, `sources.${index}.dir`);
        }
        const auth = src.auth;
        if (auth) {
            if (auth.kind !== "httpHeader")
                fail(`sources.${index}.auth.kind`, "Invalid kind");
            const ref = (auth.secretRef ?? "").trim();
            if (!secretRefOk(ref)) {
                fail(`sources.${index}.auth.secretRef`, "secretRef must be alphanumeric with dashes/underscores (max 60 chars)");
            }
            return {
                id,
                type: "zip",
                url,
                dir: dirRaw === undefined ? undefined : dirTrimmed,
                auth: { kind: "httpHeader", secretRef: ref }
            };
        }
        return { id, type: "zip", url, dir: dirRaw === undefined ? undefined : dirTrimmed };
    });
    return { version: "v1", courseCode, subject, uidNamespace, sources };
}
export function SourcesManagerPage() {
    const [config, setConfig] = useState(null);
    const [secrets, setSecrets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [tab, setTab] = useState("sources");
    const [configSaving, setConfigSaving] = useState(false);
    const [testResults, setTestResults] = useState({});
    // Secret modal state
    const [secretModalOpen, setSecretModalOpen] = useState(false);
    const [secretName, setSecretName] = useState("");
    const [secretValue, setSecretValue] = useState("");
    const [showSecretValue, setShowSecretValue] = useState(false);
    const [secretSaving, setSecretSaving] = useState(false);
    const [secretModalNotice, setSecretModalNotice] = useState(null);
    // Source modal state
    const [sourceModalOpen, setSourceModalOpen] = useState(false);
    const [sourceEditingIndex, setSourceEditingIndex] = useState(null);
    const [sourceModalNotice, setSourceModalNotice] = useState(null);
    const [sourceSaving, setSourceSaving] = useState(false);
    const [sourceType, setSourceType] = useState("github");
    const [sourceId, setSourceId] = useState("");
    const [sourceDir, setSourceDir] = useState("");
    const [githubRepo, setGithubRepo] = useState("");
    const [githubBranch, setGithubBranch] = useState("");
    const [zipUrl, setZipUrl] = useState("");
    const [driveFolderId, setDriveFolderId] = useState("");
    const [authEnabled, setAuthEnabled] = useState(false);
    const [authKind, setAuthKind] = useState("githubToken");
    const [secretRef, setSecretRef] = useState("");
    const secretNames = useMemo(() => secrets.map((s) => s.name), [secrets]);
    const configJson = useMemo(() => (config ? JSON.stringify(config, null, 2) : null), [config]);
    const refreshSecrets = async () => {
        const res = await listSecrets();
        setSecrets(res.secrets ?? []);
    };
    const refreshConfig = async () => {
        const cfg = await getSources();
        setConfig(cfg);
    };
    const closeSecretModal = () => {
        setSecretModalOpen(false);
        setSecretName("");
        setSecretValue("");
        setShowSecretValue(false);
        setSecretModalNotice(null);
    };
    const openSecretModal = (name) => {
        setSecretModalOpen(true);
        setSecretName(name ?? "");
        setSecretValue("");
        setShowSecretValue(false);
        setSecretModalNotice(null);
    };
    const closeSourceModal = () => {
        setSourceModalOpen(false);
        setSourceEditingIndex(null);
        setSourceModalNotice(null);
        setSourceSaving(false);
        setSourceType("github");
        setSourceId("");
        setSourceDir("");
        setGithubRepo("");
        setGithubBranch("");
        setZipUrl("");
        setDriveFolderId("");
        setAuthEnabled(false);
        setAuthKind("githubToken");
        setSecretRef("");
    };
    const openSourceModal = (index, draftType = "github") => {
        setSourceModalOpen(true);
        setSourceModalNotice(null);
        if (config && index !== undefined) {
            setSourceEditingIndex(index);
            const src = config.sources[index];
            setSourceType(src.type);
            setSourceId(src.id ?? "");
            setSourceDir(src.dir ?? "");
            if (src.type === "github") {
                setGithubRepo(src.repo ?? "");
                setGithubBranch(src.branch ?? "");
                setZipUrl("");
                setDriveFolderId("");
                setAuthKind("githubToken");
            }
            else if (src.type === "gdrive") {
                setDriveFolderId(src.folderId ?? "");
                setZipUrl("");
                setGithubRepo("");
                setGithubBranch("");
                setAuthKind("httpHeader");
            }
            else {
                setZipUrl(src.url ?? "");
                setDriveFolderId("");
                setGithubRepo("");
                setGithubBranch("");
                setAuthKind("httpHeader");
            }
            if (src.auth) {
                setAuthEnabled(true);
                setSecretRef(src.auth.secretRef ?? "");
                setAuthKind(src.auth.kind);
            }
            else {
                setAuthEnabled(false);
                setSecretRef("");
            }
        }
        else {
            setSourceEditingIndex(null);
            setSourceType(draftType);
            setSourceId("");
            setSourceDir("");
            setGithubRepo("");
            setGithubBranch("");
            setZipUrl("");
            setDriveFolderId("");
            setAuthEnabled(false);
            setAuthKind(draftType === "github" ? "githubToken" : "httpHeader");
            setSecretRef("");
        }
    };
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setPageError(null);
        Promise.all([getSources(), listSecrets()])
            .then(([cfg, secretsRes]) => {
            if (cancelled)
                return;
            setConfig(cfg);
            setSecrets(secretsRes.secrets ?? []);
        })
            .catch((err) => {
            if (cancelled)
                return;
            setPageError(err?.message ?? "Failed to load");
        })
            .finally(() => {
            if (cancelled)
                return;
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const saveSecret = async () => {
        const name = secretName.trim();
        if (!name) {
            setSecretModalNotice({ tone: "error", text: "Secret name is required." });
            return;
        }
        if (!secretValue) {
            setSecretModalNotice({ tone: "error", text: "Secret value is required." });
            return;
        }
        setSecretSaving(true);
        setSecretModalNotice(null);
        try {
            await putSecret(name, secretValue);
            await refreshSecrets();
            setNotice({ tone: "success", text: `Saved secret: ${name}` });
            closeSecretModal(); // clears value from state
        }
        catch (err) {
            setSecretModalNotice({ tone: "error", text: err?.message ?? "Save failed" });
        }
        finally {
            setSecretSaving(false);
            setSecretValue(""); // extra safety
        }
    };
    const confirmAndDeleteSecret = async (name) => {
        const ok = window.confirm(`Delete secret "${name}"? This cannot be undone.`);
        if (!ok)
            return;
        setNotice(null);
        try {
            await deleteSecret(name);
            await refreshSecrets();
            setNotice({ tone: "success", text: `Deleted secret: ${name}` });
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Delete failed" });
        }
    };
    const authBadge = (src) => {
        if (!src.auth)
            return _jsx(Badge, { tone: "muted", children: "No auth" });
        const exists = secretNames.includes(src.auth.secretRef);
        if (!exists) {
            return (_jsxs(Badge, { tone: "warn", children: ["Missing secret: ", _jsx("span", { className: "font-mono", children: src.auth.secretRef })] }));
        }
        return (_jsxs(Badge, { tone: "info", children: ["Uses secret: ", _jsx("span", { className: "font-mono", children: src.auth.secretRef })] }));
    };
    const confirmAndDeleteSource = (index) => {
        if (!config)
            return;
        const src = config.sources[index];
        const ok = window.confirm(`Delete source "${src.id}"?`);
        if (!ok)
            return;
        const next = { ...config, sources: config.sources.filter((_, i) => i !== index) };
        setConfig(next);
        setNotice({ tone: "success", text: `Removed source: ${src.id} (not saved yet)` });
    };
    const saveSourceDraft = () => {
        if (!config) {
            setSourceModalNotice({ tone: "error", text: "Config not loaded yet." });
            return;
        }
        const id = sourceId.trim();
        if (!id) {
            setSourceModalNotice({ tone: "error", text: "Source id is required." });
            return;
        }
        if (authEnabled && !secretRef.trim()) {
            setSourceModalNotice({ tone: "error", text: "Select a secretRef for auth." });
            return;
        }
        setSourceSaving(true);
        setSourceModalNotice(null);
        try {
            let source;
            if (sourceType === "github") {
                source = {
                    id,
                    type: "github",
                    repo: githubRepo.trim(),
                    branch: githubBranch.trim(),
                    dir: sourceDir.trim(),
                    auth: authEnabled ? { kind: "githubToken", secretRef: secretRef.trim() } : undefined
                };
            }
            else if (sourceType === "gdrive") {
                source = {
                    id,
                    type: "gdrive",
                    folderId: driveFolderId.trim(),
                    auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined
                };
            }
            else {
                const dirTrimmed = sourceDir.trim();
                source = {
                    id,
                    type: "zip",
                    url: zipUrl.trim(),
                    dir: dirTrimmed ? dirTrimmed : undefined,
                    auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined
                };
            }
            const nextSources = [...config.sources];
            if (sourceEditingIndex === null) {
                nextSources.push(source);
            }
            else {
                nextSources[sourceEditingIndex] = source;
            }
            // Validate immediately using the shared Zod schema (same rules as the worker store).
            const validated = validateAndNormalizeConfig({ ...config, sources: nextSources });
            setConfig(validated);
            setNotice({ tone: "success", text: `Updated sources list (not saved yet)` });
            closeSourceModal();
        }
        catch (err) {
            setSourceModalNotice({ tone: "error", text: formatValidationError(err) });
        }
        finally {
            setSourceSaving(false);
        }
    };
    const saveConfigToServer = async () => {
        if (!config)
            return;
        setNotice(null);
        setConfigSaving(true);
        let validated;
        try {
            validated = validateAndNormalizeConfig(config);
        }
        catch (err) {
            setNotice({ tone: "error", text: formatValidationError(err) });
            setConfigSaving(false);
            return;
        }
        try {
            const stored = await putSources(validated);
            setConfig(stored);
            setNotice({ tone: "success", text: "Saved sources config" });
        }
        catch (err) {
            setNotice({ tone: "error", text: err?.message ?? "Save failed" });
        }
        finally {
            setConfigSaving(false);
        }
    };
    const runTest = async (sourceIdToTest) => {
        setNotice(null);
        try {
            const res = await testSource(sourceIdToTest);
            setTestResults((prev) => ({ ...prev, [sourceIdToTest]: { ...res, at: new Date().toISOString() } }));
            setNotice({ tone: res.ok ? "success" : "error", text: res.ok ? `Test OK (${res.status})` : `Test failed (${res.status})` });
        }
        catch (err) {
            setTestResults((prev) => ({
                ...prev,
                [sourceIdToTest]: { ok: false, status: 0, message: err?.message ?? "Test failed", at: new Date().toISOString() }
            }));
            setNotice({ tone: "error", text: err?.message ?? "Test failed" });
        }
    };
    return (_jsx(AdminAuthGate, { children: _jsxs(PageShell, { maxWidth: "4xl", className: "space-y-6", children: [_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-text", children: "Sources & Secrets" }), _jsx("p", { className: "text-sm text-textMuted", children: "Configure where banks come from (Sources) and the credentials they need (Secrets). Typical flow: create secrets \u2192 add sources \u2192 test \u2192 save." })] }), _jsx(Alert, { tone: "info", children: _jsxs("ul", { className: "list-disc pl-5 space-y-1", children: [_jsxs("li", { children: [_jsx("strong", { children: "Secrets are write-only." }), " You can create/replace a secret value, but you can\u2019t view existing values in the UI."] }), _jsxs("li", { children: [_jsx("strong", { children: "Export is CI-only." }), " The export endpoint returns resolved secrets and must never be called from a browser."] })] }) }), _jsx("div", { className: "flex flex-wrap items-center gap-2", children: _jsxs("div", { className: "inline-flex items-center gap-1 rounded-lg bg-muted p-1 border border-border", children: [_jsx(Button, { type: "button", size: "sm", variant: tab === "sources" ? "primary" : "ghost", onClick: () => setTab("sources"), "aria-pressed": tab === "sources", children: "Sources" }), _jsx(Button, { type: "button", size: "sm", variant: tab === "secrets" ? "primary" : "ghost", onClick: () => setTab("secrets"), "aria-pressed": tab === "secrets", children: "Secrets" })] }) })] }), notice ? _jsx(Alert, { tone: notice.tone, children: notice.text }) : null, pageError ? _jsx(Alert, { tone: "error", children: pageError }) : null, tab === "sources" ? (_jsxs("div", { className: "grid gap-4", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "CI Integration" }), _jsx("p", { className: "text-sm text-textMuted", children: "Export is CI-only and returns resolved secrets." })] }), _jsxs(Alert, { tone: "warn", children: ["Do ", _jsx("strong", { children: "not" }), " run the export endpoint in the browser. It returns resolved secrets and is intended for CI only."] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-text", children: "Worker base URL" }), _jsx("pre", { className: "text-xs bg-muted border border-border rounded-md p-3 overflow-auto", children: import.meta.env.VITE_API_BASE ?? "(VITE_API_BASE not set)" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-text", children: "Example curl (CI only)" }), _jsx("pre", { className: "text-xs bg-muted border border-border rounded-md p-3 overflow-auto", children: `curl -fsS \\\n  -H "Authorization: Bearer <ADMIN_TOKEN>" \\\n  "${import.meta.env.VITE_API_BASE ?? "<WORKER_BASE_URL>"}/admin/sources/export"` }), _jsx("p", { className: "text-xs text-textMuted", children: "Token is a placeholder only \u2014 the UI never reads or stores admin tokens." })] })] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Sources configuration" }), _jsx("p", { className: "text-sm text-textMuted", children: "Edit config locally, then Save to persist." })] }), _jsx("div", { className: "flex items-center gap-2", children: _jsx(Button, { type: "button", onClick: saveConfigToServer, disabled: loading || !config || configSaving, children: configSaving ? "Saving…" : "Save config" }) })] }), _jsxs(Card, { padding: "sm", className: "space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "Add a source" }), _jsx("div", { className: "text-xs text-textMuted", children: "Pick the kind of source students will pull banks from." })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("button", { type: "button", className: "text-left rounded-xl border border-border bg-card hover:bg-muted transition-colors p-4", onClick: () => openSourceModal(undefined, "github"), disabled: loading, children: [_jsx("div", { className: "font-semibold text-text", children: "GitHub repository" }), _jsxs("div", { className: "mt-1 text-xs text-textMuted", children: ["Example: ", _jsx("span", { className: "font-mono", children: "OWNER/REPO" }), " \u00B7 branch ", _jsx("span", { className: "font-mono", children: "main" }), " \u00B7 dir ", _jsx("span", { className: "font-mono", children: "discrete-math" })] })] }), _jsxs("button", { type: "button", className: "text-left rounded-xl border border-border bg-card hover:bg-muted transition-colors p-4", onClick: () => openSourceModal(undefined, "gdrive"), disabled: loading, children: [_jsx("div", { className: "font-semibold text-text", children: "Google Drive folder" }), _jsxs("div", { className: "mt-1 text-xs text-textMuted", children: ["Example: folderId ", _jsx("span", { className: "font-mono", children: "1AbC…" }), " (downloads *.tex)"] })] }), _jsxs("button", { type: "button", className: "text-left rounded-xl border border-border bg-card hover:bg-muted transition-colors p-4", onClick: () => openSourceModal(undefined, "zip"), disabled: loading, children: [_jsx("div", { className: "font-semibold text-text", children: "ZIP over HTTPS" }), _jsxs("div", { className: "mt-1 text-xs text-textMuted", children: ["Example: ", _jsx("span", { className: "font-mono", children: "https://example.com/banks.zip" }), " (optional dir)"] })] })] }), _jsxs("div", { className: "text-xs text-textMuted", children: ["If the source needs credentials, create a secret first (Secrets tab), then reference it as ", _jsx("span", { className: "font-mono", children: "secretRef" }), "."] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "course-code", children: "courseCode" }), _jsx(Input, { id: "course-code", value: config?.courseCode ?? "", onChange: (e) => config && setConfig({ ...config, courseCode: e.target.value }), disabled: loading || !config })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "subject", children: "subject" }), _jsx(Input, { id: "subject", value: config?.subject ?? "", onChange: (e) => config && setConfig({ ...config, subject: e.target.value }), disabled: loading || !config })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "uid-namespace", children: "uidNamespace" }), _jsx(Input, { id: "uid-namespace", value: config?.uidNamespace ?? "", onChange: (e) => config && setConfig({ ...config, uidNamespace: e.target.value }), disabled: loading || !config })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-base font-semibold text-text", children: "Sources" }), config ? _jsxs(Badge, { tone: "muted", children: [config.sources.length, " total"] }) : null] }), loading ? (_jsx("p", { className: "text-sm text-textMuted", children: "Loading\u2026" })) : !config ? (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium text-text", children: "No config loaded" }), _jsxs("p", { className: "text-sm text-textMuted", children: ["This usually means the admin endpoints could not be reached. Confirm you are signed in as an admin and that", _jsx("code", { className: "mx-1 font-mono", children: "VITE_API_BASE" }), "points at the Worker."] }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => void refreshConfig(), children: "Retry loading" })] })) : config.sources.length === 0 ? (_jsx("p", { className: "text-sm text-textMuted", children: "No sources yet. Add one above." })) : (_jsx("div", { className: "space-y-2", children: config.sources.map((src, index) => {
                                                const test = testResults[src.id];
                                                const authRef = src.auth?.secretRef;
                                                const missingSecret = authRef ? !secretNames.includes(authRef) : false;
                                                const nextSteps = [];
                                                if (test) {
                                                    if (test.ok) {
                                                        nextSteps.push("Looks good — click Save config to persist changes.");
                                                    }
                                                    else {
                                                        if (missingSecret && authRef) {
                                                            nextSteps.push(`Create secret "${authRef}" in the Secrets tab, then re-test.`);
                                                        }
                                                        if (test.status === 401 || test.status === 403) {
                                                            nextSteps.push("Auth failed (401/403). Verify the secret value has the right access/scopes.");
                                                        }
                                                        if (src.type === "github") {
                                                            nextSteps.push("Check repo/branch/dir are correct and accessible by the worker.");
                                                        }
                                                        else if (src.type === "gdrive") {
                                                            nextSteps.push("Check the folderId is correct and shared with the token (if provided).");
                                                        }
                                                        else {
                                                            nextSteps.push("Check the ZIP URL is reachable from the worker and returns a valid zip.");
                                                        }
                                                        nextSteps.push("After it passes, click Save config.");
                                                    }
                                                }
                                                return (_jsxs("div", { className: "rounded-lg border border-border bg-card p-3 space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "font-mono text-sm font-semibold text-text truncate", children: src.id }), _jsx(Badge, { tone: "muted", children: src.type }), authBadge(src), test ? (_jsxs(Badge, { tone: test.ok ? "success" : "error", children: ["Test: ", test.ok ? "OK" : "FAIL", " (", test.status, ")"] })) : null] }), _jsx("div", { className: "text-xs text-textMuted mt-1", children: src.type === "github" ? (_jsxs("span", { children: ["repo=", _jsx("span", { className: "font-mono", children: src.repo }), " \u00B7 branch=", _jsx("span", { className: "font-mono", children: src.branch }), " \u00B7 dir=", _jsx("span", { className: "font-mono", children: src.dir })] })) : src.type === "gdrive" ? (_jsxs("span", { children: ["folderId=", _jsx("span", { className: "font-mono break-all", children: src.folderId })] })) : (_jsxs("span", { children: ["url=", _jsx("span", { className: "font-mono break-all", children: src.url }), src.dir ? (_jsxs(_Fragment, { children: [" ", "\u00B7 dir=", _jsx("span", { className: "font-mono", children: src.dir })] })) : null] })) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => openSourceModal(index), children: "Edit" }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => runTest(src.id), children: "Test" }), _jsx(Button, { type: "button", size: "sm", variant: "danger", onClick: () => confirmAndDeleteSource(index), children: "Delete" })] })] }), test ? (_jsxs("div", { className: "rounded-lg border p-2 text-xs " +
                                                                (test.ok ? "border-success/30 bg-success/10 text-success" : "border-error/30 bg-error/10 text-error"), children: [_jsxs("div", { className: "font-medium", children: ["Last test: ", _jsx("span", { className: "font-mono", children: formatUpdatedAt(test.at) })] }), test.message ? _jsx("div", { className: "mt-1 whitespace-pre-wrap text-inherit", children: test.message }) : null, nextSteps.length ? (_jsx("ul", { className: "mt-2 list-disc pl-5 space-y-1 text-inherit", children: nextSteps.map((s) => (_jsx("li", { children: s }, s))) })) : null] })) : null] }, src.id));
                                            }) }))] }), _jsxs("details", { className: "text-xs", children: [_jsx("summary", { className: "cursor-pointer text-textMuted", children: "Raw JSON" }), _jsx("pre", { className: "mt-2 bg-muted border border-border rounded-md p-3 overflow-auto", children: loading ? "Loading…" : configJson ?? "—" })] })] })] })) : (_jsx("div", { className: "grid gap-4", children: _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Secrets" }), _jsx("p", { className: "text-sm text-textMuted", children: "Secrets are write-only; only names + timestamps are shown." })] }), _jsx(Button, { type: "button", variant: "secondary", onClick: () => openSecretModal(), children: "Create / replace secret" })] }), _jsx(Alert, { tone: "warn", children: "You can\u2019t view an existing secret value. Saving a name that already exists will replace it." }), loading ? (_jsx("p", { className: "text-sm text-textMuted", children: "Loading\u2026" })) : secrets.length === 0 ? (_jsx("p", { className: "text-sm text-textMuted", children: "No secrets." })) : (_jsx("div", { className: "space-y-2", children: secrets.map((s) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: "text-sm font-semibold text-text font-mono truncate", children: s.name }), _jsx(Badge, { tone: "muted", children: "secret" })] }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Updated: ", formatUpdatedAt(s.updatedAt)] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => openSecretModal(s.name), children: "Replace" }), _jsx(Button, { type: "button", size: "sm", variant: "danger", onClick: () => confirmAndDeleteSecret(s.name), children: "Delete" })] })] }, s.name))) }))] }) })), sourceModalOpen ? (_jsxs("div", { className: "fixed inset-0 z-40 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: closeSourceModal }), _jsxs(Card, { className: "relative w-full max-w-2xl space-y-4", padding: "md", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-text", children: "Add / edit source" }), _jsx("p", { className: "text-sm text-textMuted", children: "Secret values are never shown here\u2014only secret references." })] }), _jsx(Button, { type: "button", variant: "ghost", onClick: closeSourceModal, children: "Close" })] }), !config ? (_jsxs(Alert, { tone: "warn", children: ["Sources config has not loaded yet. Check ", _jsx("span", { className: "font-mono", children: "VITE_API_BASE" }), " / admin session. You can view the modal, but saving will fail until the API is reachable."] })) : null, sourceModalNotice ? _jsx(Alert, { tone: sourceModalNotice.tone, children: sourceModalNotice.text }) : null, _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "source-type", children: "type" }), _jsxs(Select, { id: "source-type", value: sourceType, onChange: (e) => {
                                                        const next = e.target.value;
                                                        setSourceType(next);
                                                        setAuthEnabled(false);
                                                        setSecretRef("");
                                                        setSourceModalNotice(null);
                                                        setAuthKind(next === "github" ? "githubToken" : "httpHeader");
                                                    }, disabled: sourceSaving, children: [_jsx("option", { value: "github", children: "github" }), _jsx("option", { value: "gdrive", children: "gdrive" }), _jsx("option", { value: "zip", children: "zip" })] })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "source-id", children: "id" }), _jsx(Input, { id: "source-id", value: sourceId, onChange: (e) => setSourceId(e.target.value), disabled: sourceSaving })] }), sourceType !== "gdrive" ? (_jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsxs("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "source-dir", children: ["dir", sourceType === "zip" ? " (optional)" : ""] }), _jsx(Input, { id: "source-dir", value: sourceDir, onChange: (e) => setSourceDir(e.target.value), placeholder: sourceType === "zip" ? "(optional)" : "e.g. discrete-math", disabled: sourceSaving }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Relative only (no leading / and no '..')." })] })) : null, sourceType === "github" ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "github-repo", children: "repo" }), _jsx(Input, { id: "github-repo", value: githubRepo, onChange: (e) => setGithubRepo(e.target.value), placeholder: "OWNER/REPO", disabled: sourceSaving })] }), _jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "github-branch", children: "branch" }), _jsx(Input, { id: "github-branch", value: githubBranch, onChange: (e) => setGithubBranch(e.target.value), placeholder: "main", disabled: sourceSaving })] })] })) : sourceType === "gdrive" ? (_jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "drive-folderId", children: "folderId" }), _jsx(Input, { id: "drive-folderId", value: driveFolderId, onChange: (e) => setDriveFolderId(e.target.value), placeholder: "Google Drive folder ID", disabled: sourceSaving }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Downloads all *.tex files directly from the folder." })] })) : (_jsxs("div", { className: "space-y-1 sm:col-span-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "zip-url", children: "url" }), _jsx(Input, { id: "zip-url", value: zipUrl, onChange: (e) => setZipUrl(e.target.value), placeholder: "https://...", disabled: sourceSaving }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Must be https." })] }))] }), _jsxs(Card, { padding: "sm", className: "space-y-3 bg-white dark:bg-neutral-900", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-neutral-900 dark:text-neutral-100", children: "Auth (optional)" }), _jsx("div", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "References a secret by name (no values shown)." })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300", children: [_jsx(Switch, { id: "auth-enabled", checked: authEnabled, onChange: (v) => setAuthEnabled(v), disabled: sourceSaving }), _jsx("label", { htmlFor: "auth-enabled", children: "Enable" })] })] }), authEnabled ? (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "auth-kind", children: "kind" }), _jsx(Select, { id: "auth-kind", value: authKind, onChange: (e) => setAuthKind(e.target.value), disabled: true, children: sourceType === "github" ? (_jsx("option", { value: "githubToken", children: "githubToken" })) : (_jsx("option", { value: "httpHeader", children: "httpHeader" })) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "secret-ref", children: "secretRef" }), _jsxs(Select, { id: "secret-ref", value: secretRef, onChange: (e) => setSecretRef(e.target.value), disabled: sourceSaving, children: [_jsx("option", { value: "", children: "Select\u2026" }), secretRef && !secretNames.includes(secretRef) ? (_jsxs("option", { value: secretRef, children: [secretRef, " (missing)"] })) : null, secretNames.map((name) => (_jsx("option", { value: name, children: name }, name)))] }), _jsx("div", { className: "pt-1", children: _jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => openSecretModal(), children: "Create new secret" }) })] })] })) : null] }), _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: closeSourceModal, disabled: sourceSaving, children: "Cancel" }), _jsx(Button, { type: "button", onClick: saveSourceDraft, disabled: sourceSaving, children: sourceSaving ? "Saving…" : "Save source" })] })] })] })) : null, secretModalOpen ? (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: closeSecretModal }), _jsxs(Card, { className: "relative w-full max-w-lg space-y-4", padding: "md", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-text", children: "Create / replace secret" }), _jsx("p", { className: "text-sm text-textMuted", children: "The value is only kept in memory until you save." })] }), _jsx(Alert, { tone: "warn", children: "Secrets are write-only. If the name already exists, saving will replace the old value and you can\u2019t recover it." }), secretModalNotice ? _jsx(Alert, { tone: secretModalNotice.tone, children: secretModalNotice.text }) : null, _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "secret-name", children: "Name" }), _jsx(Input, { id: "secret-name", value: secretName, onChange: (e) => setSecretName(e.target.value), placeholder: "GITHUB_TOKEN", autoComplete: "off", disabled: secretSaving })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "secret-value", children: "Value" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "secret-value", type: showSecretValue ? "text" : "password", value: secretValue, onChange: (e) => setSecretValue(e.target.value), placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", autoComplete: "new-password", disabled: secretSaving }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => setShowSecretValue((v) => !v), disabled: secretSaving, children: showSecretValue ? "Hide" : "Show" })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: closeSecretModal, disabled: secretSaving, children: "Cancel" }), _jsx(Button, { type: "button", onClick: async () => {
                                                await saveSecret();
                                                // Keep the sources card in sync after creating secrets.
                                                try {
                                                    await refreshConfig();
                                                }
                                                catch {
                                                    // ignore
                                                }
                                            }, disabled: secretSaving, children: secretSaving ? "Saving…" : "Save" })] })] })] })) : null] }) }));
}
