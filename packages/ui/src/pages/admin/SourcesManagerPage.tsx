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
import {
  clearBanks,
  deleteSecret,
  getSources,
  listSecrets,
  putSecret,
  putSources,
  testSource,
  getCiStatus,
  triggerCiBuild,
  uploadSourceZip,
  type SecretSummary,
  type SourceTestResponse
} from "../../api/sourcesAdmin";
import { getLatestPublicBank, listAvailableBanks } from "../../api/admin";
import type {
  BankPublicV1,
  GitHubSourceDefV1,
  GoogleDriveFolderSourceDefV1,
  SourcesConfigV1,
  ZipSourceDefV1
} from "@app/shared";
import { formatDateTime } from "../../utils/time";
import { formatTopicSummary } from "../../utils/topicDisplay";

type Notice = { tone: "success" | "error" | "warn" | "info"; text: string };

type SourceDraftType = "github" | "zip" | "gdrive";

type SourceDraftAuthKind = "githubToken" | "httpHeader";

type TestResult = SourceTestResponse & { at: string };

type BankSummary = {
  subject: string;
  total: number;
  topics: string[];
  generatedAt: string;
  basic: number;
  advanced: number;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

function formatUpdatedAt(value: string) {
  return formatDateTime(value);
}

function buildBankSummary(bank: BankPublicV1): BankSummary {
  const topicsSet = new Set<string>();
  let basic = 0;
  let advanced = 0;
  for (const q of bank.questions) {
    topicsSet.add(q.topic);
    if (q.level === "basic") basic += 1;
    if (q.level === "advanced") advanced += 1;
  }
  return {
    subject: bank.subject,
    total: bank.questions.length,
    topics: Array.from(topicsSet).sort(),
    generatedAt: bank.generatedAt,
    basic,
    advanced
  };
}

function formatValidationError(err: any): string {
  return err?.message ?? "Invalid configuration";
}

function validateAndNormalizeConfig(cfg: SourcesConfigV1): SourcesConfigV1 {
  const fail = (path: string, message: string) => {
    throw new Error(`${path}: ${message}`);
  };

  const secretRefOk = (val: string) => /^[a-zA-Z0-9-_]{1,60}$/.test(val);
  const repoOk = (val: string) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(val);

  const validateRelativeDir = (val: string, path: string) => {
    if (!val) fail(path, "dir must be relative and cannot contain '..'");
    if (val.startsWith("/")) fail(path, "dir must be relative and cannot contain '..'");
    if (val.split("/").some((part) => part === "..")) fail(path, "dir must be relative and cannot contain '..'");
  };

  if (cfg.version !== "v1") fail("version", "must be v1");

  const courseCode = cfg.courseCode.trim();
  const subject = cfg.subject.trim();
  const uidNamespace = cfg.uidNamespace.trim();
  if (!courseCode) fail("courseCode", "Required");
  if (!subject) fail("subject", "Required");
  if (!uidNamespace) fail("uidNamespace", "Required");

  const ids = new Set<string>();
  const sources = cfg.sources.map((src, index) => {
    const id = src.id.trim();
    if (!id) fail(`sources.${index}.id`, "Required");
    if (ids.has(id)) fail(`sources.${index}.id`, "id must be unique");
    ids.add(id);

      if (src.type === "github") {
        const repo = (src as any).repo?.trim?.() ?? "";
        const branch = (src as any).branch?.trim?.() ?? "";
        const dir = (src as any).dir?.trim?.() ?? "";
    const format = (src as any).format === "canvas" || (src as any).type === "canvas" ? "canvas" : "latex";
      if (!repoOk(repo)) fail(`sources.${index}.repo`, "repo must be OWNER/REPO");
      if (!branch) fail(`sources.${index}.branch`, "Required");
      validateRelativeDir(dir, `sources.${index}.dir`);

      const auth = (src as any).auth;
      if (auth) {
        if (auth.kind !== "githubToken") fail(`sources.${index}.auth.kind`, "Invalid kind");
        const ref = (auth.secretRef ?? "").trim();
        if (!secretRefOk(ref)) {
          fail(`sources.${index}.auth.secretRef`, "secretRef must be alphanumeric with dashes/underscores (max 60 chars)");
        }
        return {
          id,
          type: "github",
          repo,
          branch,
          dir,
          format,
          auth: { kind: "githubToken", secretRef: ref }
        } as GitHubSourceDefV1;
      }

      return { id, type: "github", repo, branch, dir, format } as GitHubSourceDefV1;
    }

    if (src.type === "gdrive") {
      const folderId = (src as any).folderId?.trim?.() ?? "";
      const format = (src as any).format === "canvas" ? "canvas" : "latex";
      if (!folderId) fail(`sources.${index}.folderId`, "Required");
      if (!/^[A-Za-z0-9_-]{5,}$/.test(folderId)) {
        fail(`sources.${index}.folderId`, "folderId must be alphanumeric with dashes/underscores");
      }

      const auth = (src as any).auth;
      if (auth) {
        if (auth.kind !== "httpHeader") fail(`sources.${index}.auth.kind`, "Invalid kind");
        const ref = (auth.secretRef ?? "").trim();
        if (!secretRefOk(ref)) {
          fail(`sources.${index}.auth.secretRef`, "secretRef must be alphanumeric with dashes/underscores (max 60 chars)");
        }
        return {
          id,
          type: "gdrive",
          folderId,
          format,
          auth: { kind: "httpHeader", secretRef: ref }
        } as GoogleDriveFolderSourceDefV1;
      }

      return { id, type: "gdrive", folderId, format } as GoogleDriveFolderSourceDefV1;
    }

    // zip
    const url = (src as any).url?.trim?.() ?? "";
    if (!url) fail(`sources.${index}.url`, "Required");
    if (!url.startsWith("https://")) fail(`sources.${index}.url`, "url must use https");
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      fail(`sources.${index}.url`, "Invalid url");
    }

    const dirRaw = (src as any).dir;
    const dirTrimmed = typeof dirRaw === "string" ? dirRaw.trim() : "";
    if (dirRaw !== undefined) {
      if (!dirTrimmed) fail(`sources.${index}.dir`, "dir must be relative and cannot contain '..'");
      validateRelativeDir(dirTrimmed, `sources.${index}.dir`);
    }

    const format = (src as any).format === "canvas" || (src as any).type === "canvas" ? "canvas" : "latex";

    const auth = (src as any).auth;
    if (auth) {
      if (auth.kind !== "httpHeader") fail(`sources.${index}.auth.kind`, "Invalid kind");
      const ref = (auth.secretRef ?? "").trim();
      if (!secretRefOk(ref)) {
        fail(`sources.${index}.auth.secretRef`, "secretRef must be alphanumeric with dashes/underscores (max 60 chars)");
      }
      return {
        id,
        type: "zip",
        url,
        dir: dirRaw === undefined ? undefined : dirTrimmed,
        format,
        auth: { kind: "httpHeader", secretRef: ref }
      } as ZipSourceDefV1;
    }

    return { id, type: "zip", url, dir: dirRaw === undefined ? undefined : dirTrimmed, format } as ZipSourceDefV1;
  });

  return { version: "v1", courseCode, subject, uidNamespace, sources };
}

export function SourcesManagerPage() {
  const [config, setConfig] = useState<SourcesConfigV1 | null>(null);
  const [secrets, setSecrets] = useState<SecretSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [tab, setTab] = useState<"sources" | "secrets">("sources");

  const [configSaving, setConfigSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [ciTriggering, setCiTriggering] = useState(false);
  const [ciStatus, setCiStatus] = useState<null | { status: string; conclusion: string | null; url: string; updatedAt: string }>(null);
  const [ciStatusError, setCiStatusError] = useState<string | null>(null);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearNotice, setClearNotice] = useState<Notice | null>(null);
  const [bankSummaries, setBankSummaries] = useState<BankSummary[]>([]);
  const [bankSummaryLoading, setBankSummaryLoading] = useState(false);
  const [bankSummaryError, setBankSummaryError] = useState<string | null>(null);

  // Secret modal state
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [showSecretValue, setShowSecretValue] = useState(false);
  const [secretSaving, setSecretSaving] = useState(false);
  const [secretModalNotice, setSecretModalNotice] = useState<Notice | null>(null);

  // Source modal state
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceEditingIndex, setSourceEditingIndex] = useState<number | null>(null);
  const [sourceModalNotice, setSourceModalNotice] = useState<Notice | null>(null);
  const [sourceSaving, setSourceSaving] = useState(false);

  const [sourceType, setSourceType] = useState<SourceDraftType>("github");
  const [sourceId, setSourceId] = useState("");
  const [sourceDir, setSourceDir] = useState("");

  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("");
  const [githubFormat, setGithubFormat] = useState<"latex" | "canvas">("latex");

  const [zipUrl, setZipUrl] = useState("");
  const [zipFormat, setZipFormat] = useState<"latex" | "canvas">("latex");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [driveFormat, setDriveFormat] = useState<"latex" | "canvas">("latex");
  const [uploadingZip, setUploadingZip] = useState(false);

  const [authEnabled, setAuthEnabled] = useState(false);
  const [authKind, setAuthKind] = useState<SourceDraftAuthKind>("githubToken");
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

  const triggerCi = async (forceRegen = false) => {
    setCiTriggering(true);
    try {
      const res = await triggerCiBuild(forceRegen ? { forceRegen: true } : undefined);
      setNotice({
        tone: "success",
        text: forceRegen ? `CI forced for ref: ${res.ref}` : `CI triggered for ref: ${res.ref}`
      });
      await refreshCiStatus();
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Failed to trigger CI" });
    } finally {
      setCiTriggering(false);
    }
  };

  const handleClearBanks = async () => {
    setClearNotice(null);
    setClearLoading(true);
    try {
      const res = await clearBanks();
      setClearNotice({
        tone: "success",
        text: res.deleted ? `Deleted ${res.deleted} stored bank entries.` : "No stored bank entries were found."
      });
      await refreshBankSummaries();
    } catch (err: any) {
      setClearNotice({ tone: "error", text: err?.message ?? "Failed to clear banks." });
    } finally {
      setClearLoading(false);
    }
  };

  const refreshCiStatus = async () => {
    try {
      const res = await getCiStatus();
      setCiStatusError(null);
      if (!res.run) {
        setCiStatus(null);
        return;
      }
      setCiStatus({
        status: res.run.status,
        conclusion: res.run.conclusion,
        url: res.run.html_url,
        updatedAt: res.run.updated_at
      });
      if (res.run.status === "completed" && API_BASE) {
        void refreshBankSummaries();
      }
    } catch (err: any) {
      setCiStatusError(err?.message ?? "Failed to fetch CI status");
    }
  };

  const refreshBankSummaries = async () => {
    if (!API_BASE) {
      setBankSummaryError("VITE_API_BASE not set");
      setBankSummaries([]);
      return;
    }
    setBankSummaryLoading(true);
    try {
      const res = await listAvailableBanks(API_BASE);
      const subjects = res.subjects ?? [];
      if (!subjects.length) {
        setBankSummaries([]);
        setBankSummaryError(null);
        return;
      }
      const summaries = await Promise.all(
        subjects.map(async (subject) => buildBankSummary(await getLatestPublicBank(API_BASE, subject)))
      );
      summaries.sort((a, b) => a.subject.localeCompare(b.subject));
      setBankSummaries(summaries);
      setBankSummaryError(null);
    } catch (err: any) {
      setBankSummaryError(err?.message ?? "Failed to load bank stats");
    } finally {
      setBankSummaryLoading(false);
    }
  };

  const closeSecretModal = () => {
    setSecretModalOpen(false);
    setSecretName("");
    setSecretValue("");
    setShowSecretValue(false);
    setSecretModalNotice(null);
  };

  const openSecretModal = (name?: string) => {
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
    setUploadingZip(false);

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

  const openSourceModal = (index?: number, draftType: SourceDraftType = "github") => {
    setSourceModalOpen(true);
    setSourceModalNotice(null);

    if (config && index !== undefined) {
      setSourceEditingIndex(index);
      const src = config.sources[index] as any;
      setSourceType(src.type);
      setSourceId(src.id ?? "");
      setSourceDir(src.dir ?? "");

      if (src.type === "github") {
        setGithubRepo(src.repo ?? "");
        setGithubBranch(src.branch ?? "");
        setGithubFormat((src.format as "latex" | "canvas") ?? "latex");
        setZipUrl("");
        setZipFormat("latex");
        setDriveFolderId("");
        setAuthKind("githubToken");
      } else if (src.type === "gdrive") {
        setDriveFolderId(src.folderId ?? "");
        setDriveFormat((src.format as "latex" | "canvas") ?? "latex");
        setZipUrl("");
        setZipFormat("latex");
        setGithubRepo("");
        setGithubBranch("");
        setAuthKind("httpHeader");
      } else if (src.type === "canvas") {
        setZipUrl(src.url ?? "");
        setZipFormat("canvas");
        setDriveFolderId("");
        setGithubRepo("");
        setGithubBranch("");
        setAuthKind("httpHeader");
        setSourceType("zip");
      } else {
        setZipUrl(src.url ?? "");
        setZipFormat((src.format as "latex" | "canvas") ?? "latex");
        setDriveFolderId("");
        setGithubRepo("");
        setGithubBranch("");
        setAuthKind("httpHeader");
      }

      if (src.auth) {
        setAuthEnabled(true);
        setSecretRef(src.auth.secretRef ?? "");
        setAuthKind(src.auth.kind as SourceDraftAuthKind);
      } else {
        setAuthEnabled(false);
        setSecretRef("");
      }
    } else {
      setSourceEditingIndex(null);
      setSourceType(draftType);
      setSourceId("");
      setSourceDir("");
      setGithubRepo("");
      setGithubBranch("");
      setGithubFormat("latex");
      setZipUrl("");
      setZipFormat("latex");
      setDriveFolderId("");
      setDriveFormat("latex");
      setAuthEnabled(false);
      setAuthKind(draftType === "github" ? "githubToken" : "httpHeader");
      setSecretRef("");
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageError(null);

    Promise.allSettled([getSources(), listSecrets()])
      .then((results) => {
        if (cancelled) return;
        const [cfgRes, secretsRes] = results;
        if (cfgRes.status === "fulfilled") {
          setConfig(cfgRes.value);
        } else {
          setPageError(cfgRes.reason?.message ?? "Failed to load sources");
        }
        if (secretsRes.status === "fulfilled") {
          setSecrets(secretsRes.value.secrets ?? []);
        } else {
          setPageError(secretsRes.reason?.message ?? "Failed to load secrets");
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshCiStatus();
  }, []);

  useEffect(() => {
    if (!API_BASE) return;
    void refreshBankSummaries();
  }, []);

  useEffect(() => {
    if (!ciStatus) return;
    if (ciStatus.status !== "queued" && ciStatus.status !== "in_progress") return;
    const id = window.setInterval(() => {
      void refreshCiStatus();
    }, 10000);
    return () => window.clearInterval(id);
  }, [ciStatus]);

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
    } catch (err: any) {
      setSecretModalNotice({ tone: "error", text: err?.message ?? "Save failed" });
    } finally {
      setSecretSaving(false);
      setSecretValue(""); // extra safety
    }
  };

  const confirmAndDeleteSecret = async (name: string) => {
    const ok = window.confirm(`Delete secret "${name}"? This cannot be undone.`);
    if (!ok) return;

    setNotice(null);
    try {
      await deleteSecret(name);
      await refreshSecrets();
      setNotice({ tone: "success", text: `Deleted secret: ${name}` });
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Delete failed" });
    }
  };

  const authBadge = (src: GitHubSourceDefV1 | ZipSourceDefV1 | GoogleDriveFolderSourceDefV1) => {
    if (!src.auth) return <Badge tone="muted">No auth</Badge>;
    const exists = secretNames.includes(src.auth.secretRef);
    if (!exists) {
      return (
        <Badge tone="warn">
          Missing secret: <span className="font-mono">{src.auth.secretRef}</span>
        </Badge>
      );
    }
    return (
      <Badge tone="info">
        Uses secret: <span className="font-mono">{src.auth.secretRef}</span>
      </Badge>
    );
  };

  const confirmAndDeleteSource = (index: number) => {
    if (!config) return;
    const src = config.sources[index];
    const ok = window.confirm(`Delete source "${src.id}"?`);
    if (!ok) return;
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
      let source: GitHubSourceDefV1 | ZipSourceDefV1 | GoogleDriveFolderSourceDefV1;
      if (sourceType === "github") {
        source = {
          id,
          type: "github",
          repo: githubRepo.trim(),
          branch: githubBranch.trim(),
          dir: sourceDir.trim(),
          format: githubFormat,
          auth: authEnabled ? { kind: "githubToken", secretRef: secretRef.trim() } : undefined
        };
      } else if (sourceType === "gdrive") {
        source = {
          id,
          type: "gdrive",
          folderId: driveFolderId.trim(),
          format: driveFormat,
          auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined
        };
      } else {
        const dirTrimmed = sourceDir.trim();
        source = {
          id,
          type: "zip",
          url: zipUrl.trim(),
          dir: dirTrimmed ? dirTrimmed : undefined,
          format: zipFormat,
          auth: authEnabled ? { kind: "httpHeader", secretRef: secretRef.trim() } : undefined
        };
      }

      const nextSources = [...config.sources];
      if (sourceEditingIndex === null) {
        nextSources.push(source);
      } else {
        nextSources[sourceEditingIndex] = source;
      }

      // Validate immediately using the shared Zod schema (same rules as the worker store).
      const validated = validateAndNormalizeConfig({ ...config, sources: nextSources } as SourcesConfigV1);
      setConfig(validated);
      setNotice({ tone: "success", text: `Updated sources list (not saved yet)` });
      closeSourceModal();
    } catch (err: any) {
      setSourceModalNotice({ tone: "error", text: formatValidationError(err) });
    } finally {
      setSourceSaving(false);
    }
  };

  const saveConfigToServer = async () => {
    if (!config) return;

    setNotice(null);
    setConfigSaving(true);

    let validated: SourcesConfigV1;
    try {
      validated = validateAndNormalizeConfig(config);
    } catch (err: any) {
      setNotice({ tone: "error", text: formatValidationError(err) });
      setConfigSaving(false);
      return;
    }

    try {
      const stored = await putSources(validated);
      setConfig(stored);
      setNotice({ tone: "success", text: "Saved sources config" });
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Save failed" });
    } finally {
      setConfigSaving(false);
    }
  };

  const runTest = async (sourceIdToTest: string) => {
    setNotice(null);
    try {
      const res = await testSource(sourceIdToTest);
      setTestResults((prev) => ({ ...prev, [sourceIdToTest]: { ...res, at: new Date().toISOString() } }));
      setNotice({ tone: res.ok ? "success" : "error", text: res.ok ? `Test OK (${res.status})` : `Test failed (${res.status})` });
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [sourceIdToTest]: { ok: false, status: 0, message: err?.message ?? "Test failed", at: new Date().toISOString() }
      }));
      setNotice({ tone: "error", text: err?.message ?? "Test failed" });
    }
  };

  return (
    <AdminAuthGate>
      <PageShell maxWidth="4xl" className="space-y-6">
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Sources &amp; Secrets</h1>
            <p className="text-sm text-textMuted">
              Configure where banks come from (Sources) and the credentials they need (Secrets). Typical flow: create secrets → add sources → test → save.
            </p>
          </div>

          <Alert tone="info">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Secrets are write-only.</strong> You can create/replace a secret value, but you can’t view existing values in the UI.
              </li>
              <li>
                <strong>Export is CI-only.</strong> The export endpoint returns resolved secrets and must never be called from a browser.
              </li>
            </ul>
          </Alert>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 border border-border">
              <Button type="button" size="sm" variant={tab === "sources" ? "primary" : "ghost"} onClick={() => setTab("sources")}
                aria-pressed={tab === "sources"}
              >
                Sources
              </Button>
              <Button type="button" size="sm" variant={tab === "secrets" ? "primary" : "ghost"} onClick={() => setTab("secrets")}
                aria-pressed={tab === "secrets"}
              >
                Secrets
              </Button>
            </div>
          </div>
        </div>

        {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
        {pageError ? <Alert tone="error">{pageError}</Alert> : null}

        {tab === "sources" ? (
          <div className="grid gap-4">
            <Card className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text">CI Integration</h2>
                <p className="text-sm text-textMuted">Export is CI-only and returns resolved secrets.</p>
              </div>

              <Alert tone="warn">
                Do <strong>not</strong> run the export endpoint in the browser. It returns resolved secrets and is intended for CI only.
              </Alert>

              <div className="space-y-2">
                <div className="text-sm font-medium text-text">Worker base URL</div>
                <pre className="text-xs bg-muted border border-border rounded-md p-3 overflow-auto">
                  {import.meta.env.VITE_API_BASE ?? "(VITE_API_BASE not set)"}
                </pre>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-text">Example curl (CI only)</div>
                <pre className="text-xs bg-muted border border-border rounded-md p-3 overflow-auto">
                  {`curl -fsS \\\n  -H "Authorization: Bearer <ADMIN_TOKEN>" \\\n  "${import.meta.env.VITE_API_BASE ?? "<WORKER_BASE_URL>"}/admin/sources/export"`}
                </pre>
                <p className="text-xs text-textMuted">Token is a placeholder only — the UI never reads or stores admin tokens.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => triggerCi(false)} disabled={ciTriggering}>
                  {ciTriggering ? "Triggering…" : "Trigger CI build"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => triggerCi(true)} disabled={ciTriggering}>
                  Force regenerate banks
                </Button>
                <Button type="button" variant="danger" onClick={handleClearBanks} disabled={clearLoading}>
                  {clearLoading ? "Clearing…" : "Clear generated banks"}
                </Button>
                <p className="text-xs text-textMuted">Runs the GitHub Actions workflow_dispatch to regenerate banks.</p>
              </div>
              {clearNotice ? <Alert tone={clearNotice.tone}>{clearNotice.text}</Alert> : null}
              {ciStatusError ? (
                <Alert tone="error">{ciStatusError}</Alert>
              ) : ciStatus ? (
                <div className="text-xs text-textMuted">
                  <div>
                    Status: <span className="font-semibold text-text">{ciStatus.status}</span>
                    {ciStatus.conclusion ? (
                      <>
                        {" "}
                        · Conclusion: <span className="font-semibold text-text">{ciStatus.conclusion}</span>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-1">
                    <a className="text-info hover:underline" href={ciStatus.url} target="_blank" rel="noreferrer">
                      View workflow run
                    </a>{" "}
                    · Updated {formatDateTime(ciStatus.updatedAt)}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-textMuted">No recent workflow run found.</div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-text">Latest bank stats</div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={refreshBankSummaries}
                    disabled={bankSummaryLoading || !API_BASE}
                  >
                    {bankSummaryLoading ? "Refreshing…" : "Refresh"}
                  </Button>
                </div>
                {bankSummaryError ? (
                  <Alert tone="error">{bankSummaryError}</Alert>
                ) : bankSummaryLoading ? (
                  <p className="text-xs text-textMuted">Loading bank stats…</p>
                ) : bankSummaries.length === 0 ? (
                  <p className="text-xs text-textMuted">No banks found.</p>
                ) : (
                  <div className="space-y-2">
                    {bankSummaries.map((summary) => (
                      <div
                        key={summary.subject}
                        className="rounded-lg border border-border bg-card px-3 py-2 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-text">{summary.subject}</div>
                          <div className="text-xs text-textMuted">
                            Generated {formatDateTime(summary.generatedAt)}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge tone="info">Questions {summary.total}</Badge>
                          <Badge tone="success">Basic {summary.basic}</Badge>
                          <Badge tone="warn">Advanced {summary.advanced}</Badge>
                          <Badge tone="muted">Topics {summary.topics.length}</Badge>
                        </div>
                        <div className="text-xs text-textMuted">
                          Topics: {summary.topics.length ? formatTopicSummary(summary.topics) : "None"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-text">Sources configuration</h2>
                  <p className="text-sm text-textMuted">Edit config locally, then Save to persist.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" onClick={saveConfigToServer} disabled={loading || !config || configSaving}>
                    {configSaving ? "Saving…" : "Save config"}
                  </Button>
                </div>
              </div>

              <Card padding="sm" className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-text">Add a source</div>
                  <div className="text-xs text-textMuted">Pick the kind of source students will pull banks from.</div>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    className="w-full text-left rounded-xl border border-border bg-card hover:bg-muted transition-colors p-4 overflow-hidden"
                    onClick={() => openSourceModal(undefined, "github")}
                    disabled={loading}
                  >
                    <div className="font-semibold text-text">GitHub repository</div>
                    <div className="mt-1 text-xs text-textMuted break-words">
                      Example: <span className="font-mono">OWNER/REPO</span> · branch <span className="font-mono">main</span> · dir <span className="font-mono">discrete-math</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="w-full text-left rounded-xl border border-border bg-card hover:bg-muted transition-colors p-4 overflow-hidden"
                    onClick={() => openSourceModal(undefined, "gdrive")}
                    disabled={loading}
                  >
                    <div className="font-semibold text-text">Google Drive folder</div>
                    <div className="mt-1 text-xs text-textMuted break-words">
                      Example: folderId <span className="font-mono">1AbC…</span> (latex or canvas)
                    </div>
                  </button>

                  <button
                    type="button"
                    className="w-full text-left rounded-xl border border-border bg-card hover:bg-muted transition-colors p-4 overflow-hidden"
                    onClick={() => openSourceModal(undefined, "zip")}
                    disabled={loading}
                  >
                    <div className="font-semibold text-text">Direct link to ZIP</div>
                    <div className="mt-1 text-xs text-textMuted break-words">
                      Example: <span className="font-mono">https://example.com/banks.zip</span> (latex or canvas)
                    </div>
                  </button>
                </div>

                <div className="text-xs text-textMuted">
                  If the source needs credentials, create a secret first (Secrets tab), then reference it as <span className="font-mono">secretRef</span>.
                </div>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text" htmlFor="course-code">
                    courseCode
                  </label>
                  <Input
                    id="course-code"
                    value={config?.courseCode ?? ""}
                    onChange={(e) => config && setConfig({ ...config, courseCode: e.target.value })}
                    disabled={loading || !config}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text" htmlFor="subject">
                    subject
                  </label>
                  <Input
                    id="subject"
                    value={config?.subject ?? ""}
                    onChange={(e) => config && setConfig({ ...config, subject: e.target.value })}
                    disabled={loading || !config}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-text" htmlFor="uid-namespace">
                    uidNamespace
                  </label>
                  <Input
                    id="uid-namespace"
                    value={config?.uidNamespace ?? ""}
                    onChange={(e) => config && setConfig({ ...config, uidNamespace: e.target.value })}
                    disabled={loading || !config}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-text">Sources</h3>
                  {config ? <Badge tone="muted">{config.sources.length} total</Badge> : null}
                </div>

                {loading ? (
                  <p className="text-sm text-textMuted">Loading…</p>
                ) : !config ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-text">No config loaded</p>
                    <p className="text-sm text-textMuted">
                      This usually means the admin endpoints could not be reached. Confirm you are signed in as an admin and that
                      <code className="mx-1 font-mono">VITE_API_BASE</code>
                      points at the Worker.
                    </p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void refreshConfig()}>
                      Retry loading
                    </Button>
                  </div>
                ) : config.sources.length === 0 ? (
                  <p className="text-sm text-textMuted">No sources yet. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {config.sources.map((src, index) => {
                      const test = testResults[src.id];
                      const authRef = (src as any).auth?.secretRef as string | undefined;
                      const missingSecret = authRef ? !secretNames.includes(authRef) : false;

                      const nextSteps: string[] = [];
                      if (test) {
                        if (test.ok) {
                          nextSteps.push("Looks good — click Save config to persist changes.");
                        } else {
                          if (missingSecret && authRef) {
                            nextSteps.push(`Create secret "${authRef}" in the Secrets tab, then re-test.`);
                          }
                          if (test.status === 401 || test.status === 403) {
                            nextSteps.push("Auth failed (401/403). Verify the secret value has the right access/scopes.");
                          }
                          if (src.type === "github") {
                            nextSteps.push("Check repo/branch/dir are correct and accessible by the worker.");
                          } else if (src.type === "gdrive") {
                            nextSteps.push("Check the folderId is correct and shared with the token (if provided).");
                          } else {
                            nextSteps.push("Check the ZIP URL is reachable from the worker and returns a valid zip.");
                          }
                          nextSteps.push("After it passes, click Save config.");
                        }
                      }

                      return (
                        <div key={src.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-sm font-semibold text-text truncate">{src.id}</span>
                                <Badge tone="muted">{src.type}</Badge>
                                {authBadge(src as any)}
                                {test ? (
                                  <Badge tone={test.ok ? "success" : "error"}>
                                    Test: {test.ok ? "OK" : "FAIL"} ({test.status})
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="text-xs text-textMuted mt-1">
                                {src.type === "github" ? (
                                  <span>
                                    repo=<span className="font-mono">{(src as any).repo}</span> · branch=<span className="font-mono">{(src as any).branch}</span> · dir=<span className="font-mono">{(src as any).dir}</span>
                                    {" "}· format=<span className="font-mono">{(src as any).format ?? "latex"}</span>
                                  </span>
                                ) : src.type === "gdrive" ? (
                                  <span>
                                    folderId=<span className="font-mono break-all">{(src as any).folderId}</span>
                                    {" "}· format=<span className="font-mono">{(src as any).format ?? "latex"}</span>
                                  </span>
                                ) : (
                                  <span>
                                    url=<span className="font-mono break-all">{(src as any).url}</span>
                                    {(src as any).dir ? (
                                      <>
                                        {" "}· dir=<span className="font-mono">{(src as any).dir}</span>
                                      </>
                                    ) : null}
                                    {" "}· format=<span className="font-mono">{(src as any).format ?? "latex"}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button type="button" size="sm" variant="secondary" onClick={() => openSourceModal(index)}>
                                Edit
                              </Button>
                              <Button type="button" size="sm" variant="secondary" onClick={() => runTest(src.id)}>
                                Test
                              </Button>
                              <Button type="button" size="sm" variant="danger" onClick={() => confirmAndDeleteSource(index)}>
                                Delete
                              </Button>
                            </div>
                          </div>

                          {test ? (
                            <div
                              className={
                                "rounded-lg border p-2 text-xs " +
                                (test.ok ? "border-success/30 bg-success/10 text-success" : "border-error/30 bg-error/10 text-error")
                              }
                            >
                              <div className="font-medium">
                                Last test: <span className="font-mono">{formatUpdatedAt(test.at)}</span>
                              </div>
                              {test.message ? <div className="mt-1 whitespace-pre-wrap text-inherit">{test.message}</div> : null}
                              {nextSteps.length ? (
                                <ul className="mt-2 list-disc pl-5 space-y-1 text-inherit">
                                  {nextSteps.map((s) => (
                                    <li key={s}>{s}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-textMuted">Raw JSON</summary>
                <pre className="mt-2 bg-muted border border-border rounded-md p-3 overflow-auto">{loading ? "Loading…" : configJson ?? "—"}</pre>
              </details>
            </Card>
          </div>
        ) : (
          <div className="grid gap-4">
            <Card className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-text">Secrets</h2>
                  <p className="text-sm text-textMuted">Secrets are write-only; only names + timestamps are shown.</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => openSecretModal()}>
                  Create / replace secret
                </Button>
              </div>

              <Alert tone="warn">You can’t view an existing secret value. Saving a name that already exists will replace it.</Alert>

              {loading ? (
                <p className="text-sm text-textMuted">Loading…</p>
              ) : secrets.length === 0 ? (
                <p className="text-sm text-textMuted">No secrets.</p>
              ) : (
                <div className="space-y-2">
                  {secrets.map((s) => (
                    <div
                      key={s.name}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-semibold text-text font-mono truncate">{s.name}</span>
                          <Badge tone="muted">secret</Badge>
                        </div>
                        <div className="text-xs text-textMuted">Updated: {formatUpdatedAt(s.updatedAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => openSecretModal(s.name)}>
                          Replace
                        </Button>
                        <Button type="button" size="sm" variant="danger" onClick={() => confirmAndDeleteSecret(s.name)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Source modal */}
        {sourceModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/40" onClick={closeSourceModal} />
            <Card
              className="relative w-full max-w-2xl space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto"
              padding="md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-text">Add / edit source</h3>
                  <p className="text-sm text-textMuted">
                    Choose the source type below. For ZIP sources, pick <span className="font-mono">format</span> =
                    <span className="font-mono"> latex</span> or <span className="font-mono"> canvas</span> in the form.
                    Secret values are never shown—only secret references.
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={closeSourceModal}>
                  Close
                </Button>
              </div>

              {!config ? (
                <Alert tone="warn">
                  Sources config has not loaded yet. Check <span className="font-mono">VITE_API_BASE</span> / admin session.
                  You can view the modal, but saving will fail until the API is reachable.
                </Alert>
              ) : null}
              {sourceModalNotice ? <Alert tone={sourceModalNotice.tone}>{sourceModalNotice.text}</Alert> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="source-type">
                    type
                  </label>
                  <Select
                    id="source-type"
                    value={sourceType}
                    onChange={(e) => {
                      const next = e.target.value as SourceDraftType;
                      setSourceType(next);
                      setAuthEnabled(false);
                      setSecretRef("");
                      setSourceModalNotice(null);
                      setAuthKind(next === "github" ? "githubToken" : "httpHeader");
                    }}
                    disabled={sourceSaving}
                  >
                    <option value="github">github</option>
                    <option value="gdrive">gdrive</option>
                    <option value="zip">zip</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="source-id">
                    id
                  </label>
                  <Input id="source-id" value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={sourceSaving} />
                </div>

                {sourceType !== "gdrive" && !(sourceType === "zip" && zipFormat === "canvas") ? (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="source-dir">
                      dir{sourceType === "zip" ? " (optional)" : ""}
                    </label>
                    <Input
                      id="source-dir"
                      value={sourceDir}
                      onChange={(e) => setSourceDir(e.target.value)}
                      placeholder={sourceType === "zip" ? "(optional)" : "e.g. discrete-math"}
                      disabled={sourceSaving}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Relative only (no leading / and no '..').</p>
                  </div>
                ) : null}

                {sourceType === "github" ? (
                  <>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="github-format">
                        format
                      </label>
                      <Select
                        id="github-format"
                        value={githubFormat}
                        onChange={(e) => setGithubFormat(e.target.value as "latex" | "canvas")}
                        disabled={sourceSaving}
                      >
                        <option value="latex">latex</option>
                        <option value="canvas">canvas</option>
                      </Select>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">latex = *.tex, canvas = IMS-CC *.zip</p>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="github-repo">
                        repo
                      </label>
                      <Input
                        id="github-repo"
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        placeholder="OWNER/REPO"
                        disabled={sourceSaving}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="github-branch">
                        branch
                      </label>
                      <Input
                        id="github-branch"
                        value={githubBranch}
                        onChange={(e) => setGithubBranch(e.target.value)}
                        placeholder="main"
                        disabled={sourceSaving}
                      />
                    </div>
                  </>
                ) : sourceType === "gdrive" ? (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="drive-folderId">
                      folderId
                    </label>
                    <Input
                      id="drive-folderId"
                      value={driveFolderId}
                      onChange={(e) => setDriveFolderId(e.target.value)}
                      placeholder="Google Drive folder ID"
                      disabled={sourceSaving}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Downloads *.tex (latex) or *.zip (canvas) from the folder.</p>
                    <div className="pt-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="drive-format">
                        format
                      </label>
                      <Select
                        id="drive-format"
                        value={driveFormat}
                        onChange={(e) => setDriveFormat(e.target.value as "latex" | "canvas")}
                        disabled={sourceSaving}
                      >
                        <option value="latex">latex</option>
                        <option value="canvas">canvas</option>
                      </Select>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">latex = *.tex, canvas = IMS-CC *.zip</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="zip-url">
                      url
                    </label>
                    <Input
                    id="zip-url"
                    value={zipUrl}
                    onChange={(e) => setZipUrl(e.target.value)}
                    placeholder="https://..."
                    disabled={sourceSaving || uploadingZip}
                    />
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Must be https.</p>
                    <div className="pt-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="zip-format">
                        format
                      </label>
                      <Select
                        id="zip-format"
                        value={zipFormat}
                        onChange={(e) => setZipFormat(e.target.value as "latex" | "canvas")}
                        disabled={sourceSaving}
                      >
                        <option value="latex">latex</option>
                        <option value="canvas">canvas</option>
                      </Select>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">latex = *.tex inside zip, canvas = IMS-CC zip</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Input
                        id="zip-upload"
                        type="file"
                        accept=".zip,application/zip"
                        disabled={sourceSaving || uploadingZip}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingZip(true);
                          setSourceModalNotice(null);
                          try {
                            const form = new FormData();
                            form.append("file", file);
                            if (sourceId.trim()) {
                              form.append("sourceId", sourceId.trim());
                            }
                            const res = await uploadSourceZip(form);
                            setZipUrl(res.url);
                            if (res.warnings && res.warnings.length > 0) {
                              setSourceModalNotice({ tone: "warn", text: res.warnings.join(" ") });
                            } else {
                              setSourceModalNotice({ tone: "success", text: "Uploaded zip and filled URL." });
                            }
                          } catch (err: any) {
                            setSourceModalNotice({ tone: "error", text: err?.message ?? "Upload failed." });
                          } finally {
                            setUploadingZip(false);
                          }
                        }}
                      />
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">Upload and auto-fill URL.</span>
                    </div>
                </div>
              )}
              </div>

              <Card padding="sm" className="space-y-3 bg-white dark:bg-neutral-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Auth (optional)</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">References a secret by name (no values shown).</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                    <Switch id="auth-enabled" checked={authEnabled} onChange={(v) => setAuthEnabled(v)} disabled={sourceSaving} />
                    <label htmlFor="auth-enabled">Enable</label>
                  </div>
                </div>

                {authEnabled ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="auth-kind">
                        kind
                      </label>
                      <Select
                        id="auth-kind"
                        value={authKind}
                        onChange={(e) => setAuthKind(e.target.value as SourceDraftAuthKind)}
                        disabled
                      >
                        {sourceType === "github" ? (
                          <option value="githubToken">githubToken</option>
                        ) : (
                          <option value="httpHeader">httpHeader</option>
                        )}
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="secret-ref">
                        secretRef
                      </label>
                      <Select
                        id="secret-ref"
                        value={secretRef}
                        onChange={(e) => setSecretRef(e.target.value)}
                        disabled={sourceSaving}
                      >
                        <option value="">Select…</option>
                        {secretRef && !secretNames.includes(secretRef) ? (
                          <option value={secretRef}>
                            {secretRef} (missing)
                          </option>
                        ) : null}
                        {secretNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Select>
                      <div className="pt-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => openSecretModal()}>
                          Create new secret
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeSourceModal} disabled={sourceSaving}>
                  Cancel
                </Button>
                <Button type="button" onClick={saveSourceDraft} disabled={sourceSaving}>
                  {sourceSaving ? "Saving…" : "Save source"}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}

        {/* Secret modal */}
        {secretModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={closeSecretModal} />
            <Card className="relative w-full max-w-lg space-y-4" padding="md">
              <div>
                <h3 className="text-lg font-semibold text-text">Create / replace secret</h3>
                <p className="text-sm text-textMuted">The value is only kept in memory until you save.</p>
              </div>

              <Alert tone="warn">Secrets are write-only. If the name already exists, saving will replace the old value and you can’t recover it.</Alert>
              {secretModalNotice ? <Alert tone={secretModalNotice.tone}>{secretModalNotice.text}</Alert> : null}

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="secret-name">
                  Name
                </label>
                <Input
                  id="secret-name"
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder="GITHUB_TOKEN"
                  autoComplete="off"
                  disabled={secretSaving}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="secret-value">
                  Value
                </label>
                <div className="flex gap-2">
                  <Input
                    id="secret-value"
                    type={showSecretValue ? "text" : "password"}
                    value={secretValue}
                    onChange={(e) => setSecretValue(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={secretSaving}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowSecretValue((v) => !v)}
                    disabled={secretSaving}
                  >
                    {showSecretValue ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeSecretModal} disabled={secretSaving}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    await saveSecret();
                    // Keep the sources card in sync after creating secrets.
                    try {
                      await refreshConfig();
                    } catch {
                      // ignore
                    }
                  }}
                  disabled={secretSaving}
                >
                  {secretSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </PageShell>
    </AdminAuthGate>
  );
}
