import { useEffect, useMemo, useState } from "react";
import {
  createExam,
  createExamShortLink,
  createTemplate,
  deleteTemplate,
  getAdminExam,
  getExamTemplate,
  healthCheck,
  getLatestPublicBank,
  listAvailableBanks,
  listTemplates,
  updateExam,
  type ApiError,
  type ExamTemplateRecord,
  type ExamTemplateResponse
} from "../../api/admin";
import { useExamDraft } from "../../hooks/useExamDraft";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Toast, type ToastTone } from "../../components/ui/Toast";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { StepIndicator, type Step } from "../../components/ui/StepIndicator";
import { ConnectionCard, type ConnectionStatus } from "../../components/admin/ConnectionCard";
import { PolicyCard } from "../../components/admin/PolicyCard";
import { CompositionBuilder, type BankStats } from "../../components/admin/CompositionBuilder";
import { CodesEditor } from "../../components/admin/CodesEditor";
import { SeedCard } from "../../components/admin/SeedCard";
import { RequestPreview } from "../../components/admin/RequestPreview";
import { ResultCard, type ExamResult } from "../../components/admin/ResultCard";
import { getSubtopicIdsForCategory, isTopicCategory, type BankPublicV1, type ExamCompositionItemV1, type ExamPolicyV1 } from "@app/shared";
import { McqQuestion } from "../../components/McqQuestion";
import { FillBlankQuestion } from "../../components/FillBlankQuestion";
import { useSearchParams } from "react-router-dom";
import { formatDateTime } from "../../utils/time";
import { topicListFriendly } from "../../utils/topicDisplay";

function VersionsCard({
  policy,
  onChange,
  errors
}: {
  policy: ExamPolicyV1;
  onChange: (next: ExamPolicyV1) => void;
  errors: Record<string, string>;
}) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Versions</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">Control per-student shuffling and version counts.</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="language-select">
          Language
        </label>
        <Select
          id="language-select"
          value={policy.language ?? "vi"}
          onChange={(e) => {
            const nextLang = e.target.value as "en" | "vi";
            onChange({ ...policy, language: nextLang });
          }}
        >
          <option value="vi">Vietnamese (Tiếng Việt)</option>
          <option value="en">English (Original)</option>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="versioning-mode">
          Versioning mode
        </label>
        <Select
          id="versioning-mode"
          value={policy.versioningMode ?? "fixed"}
          onChange={(e) => {
            const nextMode = e.target.value as "fixed" | "per_student";
            onChange({
              ...policy,
              versioningMode: nextMode,
              shuffleQuestions: nextMode === "per_student" ? policy.shuffleQuestions ?? true : policy.shuffleQuestions ?? false
            });
          }}
        >
          <option value="fixed">Fixed (same for all)</option>
          <option value="per_student">Per student</option>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Shuffle questions</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Deterministic per student when enabled.</p>
        </div>
        <Switch
          id="shuffle-questions"
          checked={Boolean(policy.shuffleQuestions)}
          onChange={(value) => onChange({ ...policy, shuffleQuestions: value })}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Shuffle choices</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Reorders choices per student.</p>
        </div>
        <Switch
          id="shuffle-choices"
          checked={Boolean(policy.shuffleChoices)}
          onChange={(value) => onChange({ ...policy, shuffleChoices: value })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="version-count">
          Version count (optional)
        </label>
        <Input
          id="version-count"
          type="number"
          value={policy.versionCount ?? ""}
          onChange={(e) =>
            onChange({
              ...policy,
              versionCount: e.target.value ? Number(e.target.value) : undefined
            })
          }
          placeholder="2-50"
          hasError={Boolean(errors["policy.versionCount"])}
        />
        {errors["policy.versionCount"] ? (
          <p className="text-xs text-error" role="alert">
            {errors["policy.versionCount"]}
          </p>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">Only used when per-student; leave blank for unlimited.</p>
        )}
      </div>
    </Card>
  );
}

const API_BASE_DEFAULT = import.meta.env.VITE_API_BASE ?? "";
const API_BASE_KEY = "admin_api_base";
const TEMPLATE_STORAGE_KEY = "admin_exam_template_v1";

type ExamTemplate = {
  subject: "discrete-math";
  composition: ExamCompositionItemV1[];
  policy: ExamPolicyV1;
  codes?: string[];
  expiresAt?: string | null;
  visibility?: "public" | "private";
};
type SavedTemplate = ExamTemplateRecord;

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function formatUpdatedAt(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : formatDateTime(d);
}

function buildExamLink(subject: string, examId: string): string {
  const rawBase = import.meta.env.VITE_BASE_URL ?? "/";
  const trimmed = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
  const base = trimmed === "/" ? "" : trimmed;
  return `${window.location.origin}${base}/#/exam/${encodeURIComponent(subject)}/${encodeURIComponent(examId)}`;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(items: T[], rand: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  return shuffleWithRng(items, mulberry32(hashString(seed)));
}

function getAllowedTopicsForRow(topic: string): string[] {
  if (!topic) return [];
  if (isTopicCategory(topic)) {
    return getSubtopicIdsForCategory(topic);
  }
  return [topic];
}

function matchesTopicLevel(rowLevel: ExamCompositionItemV1["level"], questionLevel: "basic" | "advanced") {
  if (rowLevel === "none") return true;
  return questionLevel === rowLevel;
}

function buildPreviewQuestions(
  bank: BankPublicV1,
  composition: ExamCompositionItemV1[],
  policy: ExamPolicyV1,
  seed: string
) {
  const selected: BankPublicV1["questions"] = [];
  const seen = new Set<string>();
  for (const row of composition) {
    const allowedTopics = getAllowedTopicsForRow(row.topic);
    const pool = bank.questions.filter(
      (q) =>
        allowedTopics.includes(q.topic) &&
        matchesTopicLevel(row.level, q.level) &&
        !seen.has(q.uid)
    );
    const ordered =
      policy.versioningMode === "per_student"
        ? shuffleWithSeed(pool, `${seed}|pool:${row.topic}:${row.level}`)
        : pool.slice().sort((a, b) => a.number - b.number);
    if (ordered.length < row.n) {
      throw new Error(`Bank has only ${ordered.length} questions for ${row.topic}/${row.level}`);
    }
    for (let i = 0; i < row.n; i += 1) {
      const q = ordered[i];
      seen.add(q.uid);
      selected.push(q);
    }
  }
  let ordered = selected;
  if (policy.versioningMode === "per_student" && policy.shuffleQuestions) {
    ordered = shuffleWithSeed(selected, `${seed}|order`);
  }
  if (policy.versioningMode === "per_student" && policy.shuffleChoices) {
    ordered = ordered.map((q) => {
      if (q.type !== "mcq-single") return q;
      return {
        ...q,
        choices: shuffleWithSeed(q.choices, `${seed}|choices:${q.uid}`)
      };
    });
  }
  return ordered;
}

function errorKeyToFieldId(key: string): string | null {
  if (key.startsWith("composition.")) {
    const [, idx, field] = key.split(".");
    if (field) return `composition-${idx}-${field}`;
    return "composition-section";
  }
  if (key === "composition" || key === "composition.total") return "composition-section";
  if (key === "subject") return "subject";
  if (key === "seed") return "seed";
  if (key === "expiresAt") return "expires-at";
  if (key === "policy.authMode") return "auth-mode";
  if (key === "policy.solutionsMode") return "solutions-mode";
  if (key === "policy.timeLimitMinutes") return "time-limit-minutes";
  return null;
}

export function CreateExamPage() {
  const [apiBase, setApiBase] = useState(() => sessionStorage.getItem(API_BASE_KEY) ?? API_BASE_DEFAULT);
  const [searchParams] = useSearchParams();
  const { draft, setDraft, errors, warnings, normalizedRequestBody, validate, reset } = useExamDraft();

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [connectionMessage, setConnectionMessage] = useState<string | undefined>();
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const editExamId = searchParams.get("edit");
  const [editHasSubmissions, setEditHasSubmissions] = useState(false);
  const [templateExamId, setTemplateExamId] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [lastTemplate, setLastTemplate] = useState<ExamTemplate | null>(() => {
    try {
      const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ExamTemplate) : null;
    } catch {
      return null;
    }
  });
  const [templateName, setTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [bankSubjects, setBankSubjects] = useState<string[]>([]);
  const [bankSubject, setBankSubject] = useState("discrete-math");
  const [bankStats, setBankStats] = useState<BankStats | null>(null);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankLoadError, setBankLoadError] = useState<string | null>(null);
  const [bankPublic, setBankPublic] = useState<BankPublicV1 | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<BankPublicV1["questions"]>([]);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string | string[]>>({});
  const [shortLinkLoading, setShortLinkLoading] = useState(false);

  const computeBankStats = (data: BankPublicV1): BankStats => {
    const counts: BankStats["counts"] = {};
    for (const q of data.questions) {
      if (!counts[q.topic]) {
        counts[q.topic] = { basic: 0, advanced: 0 };
      }
      counts[q.topic][q.level] += 1;
    }
    const topics = Object.keys(counts).sort();
    return { topics, counts, total: data.questions.length, subject: data.subject };
  };

  const loadBankSubjects = async (base: string) => {
    if (!base) return;
    try {
      const res = await listAvailableBanks(base);
      setBankSubjects(res.subjects ?? []);
      setBankLoadError(null);
      if (!res.subjects?.length) {
        setBankSubject("");
        setBankStats(null);
      } else if (!res.subjects.includes(bankSubject)) {
        setBankSubject(res.subjects[0]);
        setBankStats(null);
      }
    } catch (err: any) {
      setBankLoadError(err?.message ?? "Failed to load bank list");
    }
  };

  const loadSelectedBank = async () => {
    if (!apiBase || !bankSubject) return;
    setBankLoading(true);
    try {
      const data = await getLatestPublicBank(apiBase, bankSubject);
      setBankStats(computeBankStats(data));
      setBankPublic(data);
      setBankLoadError(null);
    } catch (err: any) {
      setBankStats(null);
      setBankPublic(null);
      setBankLoadError(err?.message ?? "Failed to load bank");
    } finally {
      setBankLoading(false);
    }
  };

  const expiresIso = useMemo(() => {
    if (!draft.expiresEnabled || !draft.expiresAtLocal) return "";
    const date = new Date(draft.expiresAtLocal);
    if (Number.isNaN(date.getTime())) return "Invalid date";
    return date.toISOString();
  }, [draft.expiresEnabled, draft.expiresAtLocal]);

  const canCreate = !isSubmitting && Object.keys(errors).length === 0;
  const activeExamId = editExamId ?? result?.examId ?? null;

  const studentSignIn =
    draft.policy.authMode === "required"
      ? "Sign-in required"
      : draft.policy.authMode === "optional"
        ? "Sign-in optional"
        : "No sign-in";

  const studentCodes = draft.policy.requireViewCode || draft.policy.requireSubmitCode
    ? draft.policy.requireViewCode && draft.policy.requireSubmitCode
      ? "View + submit code required"
      : draft.policy.requireViewCode
        ? "View code required"
        : "Submit code required"
    : "No access codes";

  const studentSolutions =
    draft.policy.solutionsMode === "never"
      ? "No solutions shown"
      : draft.policy.solutionsMode === "after_submit"
        ? "Solutions after submit"
        : "Solutions always visible";

  const stepIndicatorSteps: Step[] = (() => {
    const keys = Object.keys(errors);
    const hasAny = (pred: (k: string) => boolean) => keys.some(pred);

    const basicsOk = !hasAny((k) => k === "subject" || k === "expiresAt");
    const accessOk = !hasAny((k) => k.startsWith("policy."));
    const compositionOk = !hasAny((k) => k === "composition" || k.startsWith("composition."));
    const versionsOk = !hasAny((k) => k === "policy.versionCount");

    const raw: Array<{ title: string; description: string; ok: boolean }> = [
      { title: "Basics", description: "Subject and expiry", ok: basicsOk },
      { title: "Access Rules", description: "Sign-in, codes, solutions", ok: accessOk },
      { title: "Composition", description: "Topics and question counts", ok: compositionOk },
      { title: "Versions", description: "Fixed vs per-student versions", ok: versionsOk },
      { title: "Review & Create", description: "Check preview then create", ok: canCreate }
    ];

    const firstPending = raw.findIndex((s) => !s.ok);
    return raw.map((s, idx) => ({
      title: s.title,
      description: s.description,
      status: s.ok ? "done" : idx === (firstPending === -1 ? raw.length - 1 : firstPending) ? "current" : "todo"
    }));
  })();

  const updateApiBase = (value: string) => {
    setApiBase(value);
    sessionStorage.setItem(API_BASE_KEY, value);
  };

  const handleTestConnection = async () => {
    setConnectionStatus("checking");
    setConnectionMessage("Testing /health...");
    setConnectionError(undefined);
    const response = await healthCheck(apiBase);
    if (response.ok) {
      setConnectionStatus("connected");
      setConnectionMessage("Healthy");
    } else {
      setConnectionStatus("error");
      setConnectionMessage(undefined);
      setConnectionError(`Health check failed (${response.error.status}). ${response.error.message}`);
    }
  };

  const handleCopy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ message, tone: "success" });
    } catch {
      setToast({ message: "Copy failed. Check browser permissions.", tone: "error" });
    }
  };

  const handleCopyExamLink = async (examId: string, subject: string) => {
    const link = buildExamLink(subject, examId);
    await handleCopy(link, "Exam link copied");
  };

  const handleCopyShortLink = async (examId: string) => {
    if (!apiBase) {
      setToast({ message: "API Base URL is required.", tone: "error" });
      return;
    }
    setShortLinkLoading(true);
    try {
      const res = await createExamShortLink({ apiBase, examId });
      await handleCopy(res.shortUrl, "Short link copied");
    } catch (err: any) {
      setToast({ message: err?.message ?? "Short link failed", tone: "error" });
    } finally {
      setShortLinkLoading(false);
    }
  };

  const handleOpenPreview = async () => {
    setPreviewError(null);
    setPreviewOpen(true);
    setPreviewAnswers({});
    const composition = normalizedRequestBody.composition;
    if (!composition.length) {
      setPreviewQuestions([]);
      setPreviewError("Add at least one composition row before previewing.");
      return;
    }
    if (!apiBase) {
      setPreviewQuestions([]);
      setPreviewError("API Base URL is required.");
      return;
    }
    setPreviewLoading(true);
    try {
      let bank = bankPublic;
      if (!bank || bank.subject !== normalizedRequestBody.subject) {
        bank = await getLatestPublicBank(apiBase, normalizedRequestBody.subject);
        setBankPublic(bank);
        setBankStats(computeBankStats(bank));
      }
      const previewSeed =
        (normalizedRequestBody.seed ?? (draft.seed ? draft.seed.trim() : "")) ||
        `preview:${normalizedRequestBody.subject}:${JSON.stringify(composition)}`;
      const questions = buildPreviewQuestions(bank, composition, normalizedRequestBody.policy, previewSeed);
      setPreviewQuestions(questions);
    } catch (err: any) {
      setPreviewQuestions([]);
      setPreviewError(err?.message ?? "Failed to build preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreate = async () => {
    setSubmitError(null);
    const ok = validate();
    if (!ok) {
      const firstKey = Object.keys(errors)[0];
      const fieldId = firstKey ? errorKeyToFieldId(firstKey) : null;
      if (fieldId) {
        document.getElementById(fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setSubmitError("Fix validation errors before creating the exam.");
      return;
    }
    if (!apiBase) {
      setSubmitError("API Base URL is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await createExam({ apiBase, body: normalizedRequestBody });
      const examUrl = buildExamLink(normalizedRequestBody.subject, response.examId);
      setResult({ ...response, examUrl });
      setToast({ message: "Exam created", tone: "success" });
      const template: ExamTemplate = {
        subject: normalizedRequestBody.subject,
        composition: normalizedRequestBody.composition,
        policy: normalizedRequestBody.policy,
        codes: normalizedRequestBody.codes,
        expiresAt: normalizedRequestBody.expiresAt ?? null,
        visibility: normalizedRequestBody.visibility ?? "private"
      };
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
      setLastTemplate(template);
    } catch (err) {
      const apiError = err as ApiError;
      const status = apiError.status ?? 0;
      const message = apiError.message ?? "Unknown error";
      setSubmitError(`Create failed (${status}). ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!apiBase) {
      setConnectionStatus("idle");
      setConnectionMessage(undefined);
      setConnectionError(undefined);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void handleTestConnection();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiBase]);

  useEffect(() => {
    void loadBankSubjects(apiBase);
  }, [apiBase]);

  const handleUpdate = async () => {
    if (!editExamId) return;
    setSubmitError(null);
    const ok = validate();
    if (!ok) {
      const firstKey = Object.keys(errors)[0];
      const fieldId = firstKey ? errorKeyToFieldId(firstKey) : null;
      if (fieldId) {
        document.getElementById(fieldId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      setSubmitError("Fix validation errors before updating the exam.");
      return;
    }
    if (!apiBase) {
      setSubmitError("API Base URL is required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const updateBody = {
        ...normalizedRequestBody,
        expiresAt: draft.expiresEnabled ? normalizedRequestBody.expiresAt ?? null : null
      };
      const response = await updateExam({ apiBase, examId: editExamId, body: updateBody });
      setToast({
        message: response.hasSubmissions ? "Updated (submissions exist)" : "Exam updated",
        tone: response.hasSubmissions ? "warn" : "success"
      });
    } catch (err) {
      const apiError = err as ApiError;
      const status = apiError.status ?? 0;
      const message = apiError.message ?? "Unknown error";
      setSubmitError(`Update failed (${status}). ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    reset();
    setResult(null);
    setSubmitError(null);
  };

  const applyTemplate = (template: ExamTemplate) => {
    setDraft((prev) => ({
      ...prev,
      subject: template.subject,
      composition: template.composition.map((row) => ({ ...row })),
      policy: { ...template.policy },
      codes: template.codes ?? [],
      codesEnabled: Boolean(
        (template.codes && template.codes.length > 0) ||
        template.policy.requireSubmitCode ||
        template.policy.requireViewCode
      ),
      expiresEnabled: Boolean(template.expiresAt),
      expiresAtLocal: template.expiresAt ? toLocalDateTimeInput(template.expiresAt) : "",
      visibility: template.visibility ?? "private",
      autoSeed: true,
      seed: ""
    }));
  };

  const handleUseLastTemplate = () => {
    if (!lastTemplate) return;
    setTemplateError(null);
    applyTemplate(lastTemplate);
    setToast({ message: "Loaded last template", tone: "success" });
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      setTemplateError("Template name is required.");
      return;
    }
    if (!apiBase) {
      setTemplateError("API Base URL is required.");
      return;
    }
    setTemplateError(null);
    try {
      const record = await createTemplate({
        apiBase,
        name,
        template: {
          subject: normalizedRequestBody.subject,
          composition: normalizedRequestBody.composition,
          policy: normalizedRequestBody.policy,
          codes: normalizedRequestBody.codes,
          expiresAt: normalizedRequestBody.expiresAt ?? null,
          visibility: normalizedRequestBody.visibility ?? "private"
        }
      });
      setSavedTemplates((prev) => [record, ...prev]);
      setTemplateName("");
      setToast({ message: "Template saved", tone: "success" });
    } catch (err) {
      const apiError = err as ApiError;
      const status = apiError.status ?? 0;
      const message = apiError.message ?? "Unknown error";
      setTemplateError(`Save failed (${status}). ${message}`);
    }
  };

  const handleUseSavedTemplate = (template: SavedTemplate) => {
    setTemplateError(null);
    applyTemplate(template.template);
    setToast({ message: "Loaded saved template", tone: "success" });
  };

  const handleDeleteTemplate = async (template: SavedTemplate) => {
    if (!apiBase) {
      setTemplateError("API Base URL is required.");
      return;
    }
    if (!window.confirm(`Delete template "${template.name}"?`)) return;
    try {
      await deleteTemplate({ apiBase, templateId: template.templateId });
      setSavedTemplates((prev) => prev.filter((item) => item.templateId !== template.templateId));
      setToast({ message: "Template deleted", tone: "success" });
    } catch (err) {
      const apiError = err as ApiError;
      const status = apiError.status ?? 0;
      const message = apiError.message ?? "Unknown error";
      setTemplateError(`Delete failed (${status}). ${message}`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!apiBase) return;
    setTemplatesLoading(true);
    listTemplates({ apiBase })
      .then((res) => {
        if (cancelled) return;
        setSavedTemplates(res.items ?? []);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setTemplateError(err?.message ?? "Failed to load templates");
      })
      .finally(() => {
        if (cancelled) return;
        setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    if (!editExamId || !apiBase) return;
    let cancelled = false;
    getAdminExam({ apiBase, examId: editExamId })
      .then((res) => {
        if (cancelled) return;
        if (res.exam.deletedAt) {
          setSubmitError("This exam is deleted and cannot be edited.");
          return;
        }
        setEditHasSubmissions(res.hasSubmissions);
        const template: ExamTemplate = {
          subject: res.exam.subject,
          composition: res.exam.composition,
          policy: res.exam.policy,
          expiresAt: res.exam.expiresAt ?? null,
          visibility: res.exam.visibility ?? "private"
        };
        applyTemplate(template);
        setDraft((prev) => ({ ...prev, title: res.exam.title ?? "" }));
      })
      .catch((err: any) => {
        if (cancelled) return;
        setSubmitError(err?.message ?? "Failed to load exam");
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase, editExamId]);

  const handleLoadTemplate = async () => {
    if (!apiBase) {
      setTemplateError("API Base URL is required.");
      return;
    }
    if (!templateExamId.trim()) {
      setTemplateError("Enter an exam ID to load.");
      return;
    }
    setTemplateError(null);
    setTemplateLoading(true);
    try {
      const res: ExamTemplateResponse = await getExamTemplate({ apiBase, examId: templateExamId.trim() });
      const template: ExamTemplate = {
        subject: res.subject,
        composition: res.composition,
        policy: res.policy,
        expiresAt: res.expiresAt,
        visibility: res.visibility
      };
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
      setLastTemplate(template);
      applyTemplate(template);
      setToast({ message: "Template loaded", tone: "success" });
    } catch (err) {
      const apiError = err as ApiError;
      const status = apiError.status ?? 0;
      const message = apiError.message ?? "Unknown error";
      setTemplateError(`Load failed (${status}). ${message}`);
    } finally {
      setTemplateLoading(false);
    }
  };

  return (
    <AdminAuthGate>
      <div>
        <div className="sticky top-0 z-50 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur shadow-sm">
          <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => validate()} disabled={isSubmitting}>
              Validate
            </Button>
            <Button type="button" variant="secondary" onClick={handleOpenPreview} disabled={isSubmitting}>
              Preview exam
            </Button>
            {activeExamId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleCopyExamLink(activeExamId, normalizedRequestBody.subject)}
                disabled={isSubmitting}
              >
                Copy link
              </Button>
            ) : null}
            {activeExamId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => window.open(buildExamLink(normalizedRequestBody.subject, activeExamId), "_blank")}
                disabled={isSubmitting}
              >
                Open
              </Button>
            ) : null}
            {activeExamId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleCopyShortLink(activeExamId)}
                disabled={isSubmitting || shortLinkLoading}
              >
                {shortLinkLoading ? "Copying..." : "Copy short link"}
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={handleReset} disabled={isSubmitting}>
              Reset
            </Button>
            <Button type="button" onClick={editExamId ? handleUpdate : handleCreate} disabled={!canCreate}>
              {isSubmitting ? (editExamId ? "Updating..." : "Creating...") : editExamId ? "Update Exam" : "Create Exam"}
            </Button>
          </div>
        </div>

        <PageShell maxWidth="6xl" className="py-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {editExamId ? "Edit Exam" : "Create Exam"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <Badge
                tone={
                  connectionStatus === "connected"
                    ? "success"
                    : connectionStatus === "error"
                      ? "error"
                      : "muted"
                }
              >
                {connectionStatus === "connected" ? "Connected" : "Not connected"}
              </Badge>
              <span className="text-xs">/{"/admin/exams"}</span>
            </div>
          </div>
          {submitError ? <Alert tone="error">{submitError}</Alert> : null}
          {editExamId ? (
            <Alert tone={editHasSubmissions ? "warn" : "info"}>
              {editHasSubmissions
                ? "This exam already has submissions. Updating will not change past submissions."
                : "Editing an existing exam. Changes apply immediately to future attempts."}
            </Alert>
          ) : null}

          <Card className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Steps</div>
              <div className="text-sm text-neutral-600 dark:text-neutral-300">Fill out each section below. The preview updates live.</div>
            </div>
            <StepIndicator steps={stepIndicatorSteps} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Template</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">
                    Reuse settings from a previous exam to avoid re-entering fields.
                  </p>
                </div>

                {templateError ? <Alert tone="error">{templateError}</Alert> : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="template-exam-id">
                      Load by exam ID
                    </label>
                    <Input
                      id="template-exam-id"
                      value={templateExamId}
                      onChange={(e) => setTemplateExamId(e.target.value)}
                      placeholder="exam-uuid"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="button" variant="secondary" onClick={handleLoadTemplate} disabled={templateLoading}>
                      {templateLoading ? "Loading..." : "Load template"}
                    </Button>
                    {lastTemplate ? (
                      <Button type="button" onClick={handleUseLastTemplate}>
                        Use last template
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="template-name">
                      Template name
                    </label>
                    <Input
                      id="template-name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Midterm template"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="secondary" onClick={handleSaveTemplate} disabled={!templateName.trim()}>
                      Save current as template
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Saved templates</div>
                  {templatesLoading ? (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">Loading templates...</div>
                  ) : savedTemplates.length ? (
                    <div className="space-y-2 text-xs">
                      {savedTemplates.map((item) => (
                        <div key={item.templateId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                          <div className="min-w-0">
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">{item.name}</div>
                            <div className="text-neutral-500 dark:text-neutral-400">
                              {formatUpdatedAt(item.updatedAt ?? item.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" size="sm" variant="secondary" onClick={() => handleUseSavedTemplate(item)}>
                              Use
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => handleDeleteTemplate(item)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">No saved templates yet.</div>
                  )}
                </div>

                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  Templates are stored on the server for admin access.
                </div>
              </Card>

              <Card className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Basics</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Choose the subject and (optionally) an expiry time.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="subject">
                    Subject
                  </label>
                  <Select
                    id="subject"
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value as "discrete-math" })}
                    hasError={Boolean(errors["subject"])}
                    aria-describedby={errors["subject"] ? "subject-error" : undefined}
                  >
                    <option value="discrete-math">Discrete Math</option>
                  </Select>
                  {errors["subject"] ? (
                    <p className="text-xs text-error" role="alert" id="subject-error">
                      {errors["subject"]}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Public listing</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        Public exams appear on the homepage until they expire.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                      <Switch
                        id="visibility-toggle"
                        checked={draft.visibility === "public"}
                        onChange={(value) => setDraft({ ...draft, visibility: value ? "public" : "private" })}
                      />
                      <label htmlFor="visibility-toggle">Public</label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="exam-title">
                    Optional label/title
                  </label>
                  <Input
                    id="exam-title"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="Midterm A"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Displayed on the exam page and stored with the exam.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="exam-notice">
                    Custom Notice / Extra Info
                  </label>
                  <textarea
                    id="exam-notice"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info"
                    rows={4}
                    value={draft.notice}
                    onChange={(e) => setDraft({ ...draft, notice: e.target.value })}
                    placeholder="Adding extra info about the exam and so on..."
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Appears at the beginning of the exam. Supports LaTeX ($...$ or $$...$$).
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Expires at</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Optional expiry timestamp (UTC sent to backend).</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                      <Switch
                        id="expires-toggle"
                        checked={draft.expiresEnabled}
                        onChange={(value) => setDraft({ ...draft, expiresEnabled: value })}
                      />
                      <label htmlFor="expires-toggle">Enable expiry</label>
                    </div>
                  </div>
                  {draft.expiresEnabled ? (
                    <div className="space-y-2">
                      <Input
                        id="expires-at"
                        type="datetime-local"
                        value={draft.expiresAtLocal}
                        onChange={(e) => setDraft({ ...draft, expiresAtLocal: e.target.value })}
                        hasError={Boolean(errors["expiresAt"])}
                        aria-describedby={errors["expiresAt"] ? "expires-error" : undefined}
                      />
                      {errors["expiresAt"] ? (
                        <p className="text-xs text-error" role="alert" id="expires-error">
                          {errors["expiresAt"]}
                        </p>
                      ) : null}
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">ISO preview: {expiresIso || "—"}</p>
                    </div>
                  ) : null}
                </div>
              </Card>

              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Access Rules</h2>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300">Configure sign-in, codes, and when solutions appear.</p>
                </div>
                <PolicyCard
                  policy={draft.policy}
                  onChange={(policy) => setDraft({ ...draft, policy })}
                  errors={errors}
                />
                <CodesEditor
                  codesEnabled={draft.codesEnabled}
                  codes={draft.codes}
                  policy={draft.policy}
                  onCodesEnabledChange={(value) =>
                    setDraft({ ...draft, codesEnabled: value, codes: value ? draft.codes : [] })
                  }
                  onCodesChange={(codes) => setDraft({ ...draft, codes })}
                />
              </div>

              <div id="composition-section" className="space-y-4">
                <Card className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Question bank</h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">Load the latest bank to populate topics and counts.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200" htmlFor="bank-subject">
                        Available bank subjects
                      </label>
                      <Select
                        id="bank-subject"
                        value={bankSubject}
                        onChange={(e) => {
                          setBankSubject(e.target.value);
                          setBankStats(null);
                        }}
                        disabled={bankSubjects.length === 0}
                      >
                        {bankSubjects.length === 0 ? (
                          <option value="">No banks found</option>
                        ) : null}
                        {bankSubjects.length > 0
                          ? bankSubjects.map((subject) => (
                            <option key={subject} value={subject}>
                              {subject}
                            </option>
                          ))
                          : null}
                      </Select>
                    </div>
                    <Button type="button" variant="secondary" onClick={loadSelectedBank} disabled={bankLoading || !bankSubject}>
                      {bankLoading ? "Loading…" : "Load bank"}
                    </Button>
                  </div>
                  {bankLoadError ? <Alert tone="error">{bankLoadError}</Alert> : null}
                  {bankStats ? (
                    <Alert tone="info">
                      Loaded {bankStats.subject} bank with {bankStats.total} questions across {bankStats.topics.length} topics
                      {bankStats.topics.length ? ` (${topicListFriendly(bankStats.topics)})` : ""}.
                    </Alert>
                  ) : null}
                </Card>
                <CompositionBuilder
                  composition={draft.composition}
                  onChange={(next) => setDraft({ ...draft, composition: next })}
                  errors={errors}
                  bankStats={bankStats}
                />
              </div>

              <VersionsCard
                policy={draft.policy}
                onChange={(policy) => setDraft({ ...draft, policy })}
                errors={errors}
              />

              <Card className="space-y-2">
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Review &amp; Create</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">
                  Review the request preview, then click <strong>Create Exam</strong> in the header.
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  The backend request body is shown in the preview; the title is included when provided.
                </p>
              </Card>
            </div>

            <div className="space-y-6">
              <ConnectionCard
                apiBase={apiBase}
                onApiBaseChange={updateApiBase}
                hideAdminToken
                hideTestButton
                onTestConnection={handleTestConnection}
                status={connectionStatus}
                statusMessage={connectionMessage}
                lastError={connectionError}
              />

              <SeedCard
                autoSeed={draft.autoSeed}
                seed={draft.seed}
                onAutoSeedChange={(value) => setDraft({ ...draft, autoSeed: value })}
                onSeedChange={(value) => setDraft({ ...draft, seed: value })}
                error={errors["seed"]}
              />

              <Card className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Student will see</div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-300">A quick summary of the student experience.</div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-600 dark:text-neutral-300">Sign-in</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{studentSignIn}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-600 dark:text-neutral-300">Access codes</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{studentCodes}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-600 dark:text-neutral-300">Solutions</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{studentSolutions}</span>
                  </div>
                </div>
              </Card>

              <div className="lg:hidden">
                <RequestPreview
                  body={normalizedRequestBody}
                  warnings={warnings}
                  errors={errors}
                  apiBase={apiBase}
                  includeTokenInCurl={false}
                  sessionAuth
                  onIncludeTokenInCurlChange={() => { }}
                  onCopyJson={(text) => handleCopy(text, "JSON copied")}
                  onCopyCurl={(text) => handleCopy(text, "curl copied")}
                  collapsible
                  idPrefix="request-preview-mobile"
                />
              </div>
              <div className="hidden lg:block">
                <RequestPreview
                  body={normalizedRequestBody}
                  warnings={warnings}
                  errors={errors}
                  apiBase={apiBase}
                  includeTokenInCurl={false}
                  sessionAuth
                  onIncludeTokenInCurlChange={() => { }}
                  onCopyJson={(text) => handleCopy(text, "JSON copied")}
                  onCopyCurl={(text) => handleCopy(text, "curl copied")}
                  idPrefix="request-preview-desktop"
                />
              </div>

              {result ? (
                <ResultCard
                  result={result}
                  onCreateAnother={handleReset}
                  onCopyShortLink={activeExamId ? () => handleCopyShortLink(activeExamId) : undefined}
                  shortLinkLoading={shortLinkLoading}
                />
              ) : null}
            </div>
          </div>

          {previewOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />
              <Card className="relative w-full max-w-5xl max-h-[90vh] overflow-auto space-y-4" padding="md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-text">Exam preview</div>
                    <div className="text-xs text-textMuted">
                      Built from the latest public bank; per-student shuffle follows the current policy and seed.
                    </div>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setPreviewOpen(false)}>
                    Close
                  </Button>
                </div>
                {previewError ? <Alert tone="error">{previewError}</Alert> : null}
                {previewLoading ? (
                  <div className="text-sm text-textMuted">Loading preview...</div>
                ) : previewQuestions.length ? (
                  <div className="space-y-4">
                    <div className="text-xs text-textMuted">Questions: {previewQuestions.length}</div>
                    {previewQuestions.map((q, idx) => (
                      <div key={q.uid}>
                        {q.type === "mcq-single" ? (
                          <McqQuestion
                            index={idx}
                            question={q}
                            answer={typeof previewAnswers[q.uid] === "string" ? (previewAnswers[q.uid] as string) : ""}
                            onChange={(uid, val) => setPreviewAnswers((prev) => ({ ...prev, [uid]: val }))}
                            showSolution={false}
                          />
                        ) : q.type === "fill-blank" ? (
                          <FillBlankQuestion
                            index={idx}
                            question={q}
                            answer={previewAnswers[q.uid]}
                            onChange={(uid, val) => setPreviewAnswers((prev) => ({ ...prev, [uid]: val }))}
                            showSolution={false}
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-textMuted">No preview questions yet.</div>
                )}
              </Card>
            </div>
          ) : null}

          {toast ? (
            <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
              <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
            </div>
          ) : null}
        </PageShell>
      </div>
    </AdminAuthGate>
  );
}
