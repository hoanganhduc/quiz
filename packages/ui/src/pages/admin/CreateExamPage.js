import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { createExam, createExamShortLink, createTemplate, deleteTemplate, getAdminExam, getExamTemplate, healthCheck, getLatestPublicBank, listAvailableBanks, listTemplates, updateExam } from "../../api/admin";
import { useExamDraft } from "../../hooks/useExamDraft";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Switch } from "../../components/ui/Switch";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { Toast } from "../../components/ui/Toast";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { StepIndicator } from "../../components/ui/StepIndicator";
import { ConnectionCard } from "../../components/admin/ConnectionCard";
import { PolicyCard } from "../../components/admin/PolicyCard";
import { CompositionBuilder } from "../../components/admin/CompositionBuilder";
import { CodesEditor } from "../../components/admin/CodesEditor";
import { SeedCard } from "../../components/admin/SeedCard";
import { RequestPreview } from "../../components/admin/RequestPreview";
import { ResultCard } from "../../components/admin/ResultCard";
import { getSubtopicIdsForCategory, isTopicCategory } from "@app/shared";
import { McqQuestion } from "../../components/McqQuestion";
import { FillBlankQuestion } from "../../components/FillBlankQuestion";
import { useSearchParams } from "react-router-dom";
import { formatDateTime } from "../../utils/time";
import { topicListFriendly } from "../../utils/topicDisplay";
function VersionsCard({ policy, onChange, errors }) {
    return (_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-neutral-900 dark:text-neutral-100", children: "Versions" }), _jsx("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Control per-student shuffling and version counts." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "versioning-mode", children: "Versioning mode" }), _jsxs(Select, { id: "versioning-mode", value: policy.versioningMode ?? "fixed", onChange: (e) => {
                            const nextMode = e.target.value;
                            onChange({
                                ...policy,
                                versioningMode: nextMode,
                                shuffleQuestions: nextMode === "per_student" ? policy.shuffleQuestions ?? true : policy.shuffleQuestions ?? false
                            });
                        }, children: [_jsx("option", { value: "fixed", children: "Fixed (same for all)" }), _jsx("option", { value: "per_student", children: "Per student" })] })] }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", children: "Shuffle questions" }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Deterministic per student when enabled." })] }), _jsx(Switch, { id: "shuffle-questions", checked: Boolean(policy.shuffleQuestions), onChange: (value) => onChange({ ...policy, shuffleQuestions: value }) })] }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", children: "Shuffle choices" }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Reorders choices per student." })] }), _jsx(Switch, { id: "shuffle-choices", checked: Boolean(policy.shuffleChoices), onChange: (value) => onChange({ ...policy, shuffleChoices: value }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "version-count", children: "Version count (optional)" }), _jsx(Input, { id: "version-count", type: "number", value: policy.versionCount ?? "", onChange: (e) => onChange({
                            ...policy,
                            versionCount: e.target.value ? Number(e.target.value) : undefined
                        }), placeholder: "2-50", hasError: Boolean(errors["policy.versionCount"]) }), errors["policy.versionCount"] ? (_jsx("p", { className: "text-xs text-error", role: "alert", children: errors["policy.versionCount"] })) : (_jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Only used when per-student; leave blank for unlimited." }))] })] }));
}
const API_BASE_DEFAULT = import.meta.env.VITE_API_BASE ?? "";
const API_BASE_KEY = "admin_api_base";
const TEMPLATE_STORAGE_KEY = "admin_exam_template_v1";
function toLocalDateTimeInput(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "";
    const pad = (n) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatUpdatedAt(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : formatDateTime(d);
}
function buildExamLink(subject, examId) {
    const rawBase = import.meta.env.VITE_BASE_URL ?? "/";
    const trimmed = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
    const base = trimmed === "/" ? "" : trimmed;
    return `${window.location.origin}${base}/#/exam/${encodeURIComponent(subject)}/${encodeURIComponent(examId)}`;
}
function hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function mulberry32(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function shuffleWithRng(items, rand) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
function shuffleWithSeed(items, seed) {
    return shuffleWithRng(items, mulberry32(hashString(seed)));
}
function getAllowedTopicsForRow(topic) {
    if (!topic)
        return [];
    if (isTopicCategory(topic)) {
        return getSubtopicIdsForCategory(topic);
    }
    return [topic];
}
function matchesTopicLevel(rowLevel, questionLevel) {
    if (rowLevel === "none")
        return true;
    return questionLevel === rowLevel;
}
function buildPreviewQuestions(bank, composition, policy, seed) {
    const selected = [];
    const seen = new Set();
    for (const row of composition) {
        const allowedTopics = getAllowedTopicsForRow(row.topic);
        const pool = bank.questions.filter((q) => allowedTopics.includes(q.topic) &&
            matchesTopicLevel(row.level, q.level) &&
            !seen.has(q.uid));
        const ordered = policy.versioningMode === "per_student"
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
            if (q.type !== "mcq-single")
                return q;
            return {
                ...q,
                choices: shuffleWithSeed(q.choices, `${seed}|choices:${q.uid}`)
            };
        });
    }
    return ordered;
}
function errorKeyToFieldId(key) {
    if (key.startsWith("composition.")) {
        const [, idx, field] = key.split(".");
        if (field)
            return `composition-${idx}-${field}`;
        return "composition-section";
    }
    if (key === "composition" || key === "composition.total")
        return "composition-section";
    if (key === "subject")
        return "subject";
    if (key === "seed")
        return "seed";
    if (key === "expiresAt")
        return "expires-at";
    if (key === "policy.authMode")
        return "auth-mode";
    if (key === "policy.solutionsMode")
        return "solutions-mode";
    if (key === "policy.timeLimitMinutes")
        return "time-limit-minutes";
    return null;
}
export function CreateExamPage() {
    const [apiBase, setApiBase] = useState(() => sessionStorage.getItem(API_BASE_KEY) ?? API_BASE_DEFAULT);
    const [searchParams] = useSearchParams();
    const { draft, setDraft, errors, warnings, normalizedRequestBody, validate, reset } = useExamDraft();
    const [connectionStatus, setConnectionStatus] = useState("idle");
    const [connectionMessage, setConnectionMessage] = useState();
    const [connectionError, setConnectionError] = useState();
    const [submitError, setSubmitError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [toast, setToast] = useState(null);
    const editExamId = searchParams.get("edit");
    const [editHasSubmissions, setEditHasSubmissions] = useState(false);
    const [templateExamId, setTemplateExamId] = useState("");
    const [templateError, setTemplateError] = useState(null);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [lastTemplate, setLastTemplate] = useState(() => {
        try {
            const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    });
    const [templateName, setTemplateName] = useState("");
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [bankSubjects, setBankSubjects] = useState([]);
    const [bankSubject, setBankSubject] = useState("discrete-math");
    const [bankStats, setBankStats] = useState(null);
    const [bankLoading, setBankLoading] = useState(false);
    const [bankLoadError, setBankLoadError] = useState(null);
    const [bankPublic, setBankPublic] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(null);
    const [previewQuestions, setPreviewQuestions] = useState([]);
    const [previewAnswers, setPreviewAnswers] = useState({});
    const [shortLinkLoading, setShortLinkLoading] = useState(false);
    const computeBankStats = (data) => {
        const counts = {};
        for (const q of data.questions) {
            if (!counts[q.topic]) {
                counts[q.topic] = { basic: 0, advanced: 0 };
            }
            counts[q.topic][q.level] += 1;
        }
        const topics = Object.keys(counts).sort();
        return { topics, counts, total: data.questions.length, subject: data.subject };
    };
    const loadBankSubjects = async (base) => {
        if (!base)
            return;
        try {
            const res = await listAvailableBanks(base);
            setBankSubjects(res.subjects ?? []);
            setBankLoadError(null);
            if (!res.subjects?.length) {
                setBankSubject("");
                setBankStats(null);
            }
            else if (!res.subjects.includes(bankSubject)) {
                setBankSubject(res.subjects[0]);
                setBankStats(null);
            }
        }
        catch (err) {
            setBankLoadError(err?.message ?? "Failed to load bank list");
        }
    };
    const loadSelectedBank = async () => {
        if (!apiBase || !bankSubject)
            return;
        setBankLoading(true);
        try {
            const data = await getLatestPublicBank(apiBase, bankSubject);
            setBankStats(computeBankStats(data));
            setBankPublic(data);
            setBankLoadError(null);
        }
        catch (err) {
            setBankStats(null);
            setBankPublic(null);
            setBankLoadError(err?.message ?? "Failed to load bank");
        }
        finally {
            setBankLoading(false);
        }
    };
    const expiresIso = useMemo(() => {
        if (!draft.expiresEnabled || !draft.expiresAtLocal)
            return "";
        const date = new Date(draft.expiresAtLocal);
        if (Number.isNaN(date.getTime()))
            return "Invalid date";
        return date.toISOString();
    }, [draft.expiresEnabled, draft.expiresAtLocal]);
    const canCreate = !isSubmitting && Object.keys(errors).length === 0;
    const activeExamId = editExamId ?? result?.examId ?? null;
    const studentSignIn = draft.policy.authMode === "required"
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
    const studentSolutions = draft.policy.solutionsMode === "never"
        ? "No solutions shown"
        : draft.policy.solutionsMode === "after_submit"
            ? "Solutions after submit"
            : "Solutions always visible";
    const stepIndicatorSteps = (() => {
        const keys = Object.keys(errors);
        const hasAny = (pred) => keys.some(pred);
        const basicsOk = !hasAny((k) => k === "subject" || k === "expiresAt");
        const accessOk = !hasAny((k) => k.startsWith("policy."));
        const compositionOk = !hasAny((k) => k === "composition" || k.startsWith("composition."));
        const versionsOk = !hasAny((k) => k === "policy.versionCount");
        const raw = [
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
    const updateApiBase = (value) => {
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
        }
        else {
            setConnectionStatus("error");
            setConnectionMessage(undefined);
            setConnectionError(`Health check failed (${response.error.status}). ${response.error.message}`);
        }
    };
    const handleCopy = async (text, message) => {
        try {
            await navigator.clipboard.writeText(text);
            setToast({ message, tone: "success" });
        }
        catch {
            setToast({ message: "Copy failed. Check browser permissions.", tone: "error" });
        }
    };
    const handleCopyExamLink = async (examId, subject) => {
        const link = buildExamLink(subject, examId);
        await handleCopy(link, "Exam link copied");
    };
    const handleCopyShortLink = async (examId) => {
        if (!apiBase) {
            setToast({ message: "API Base URL is required.", tone: "error" });
            return;
        }
        setShortLinkLoading(true);
        try {
            const res = await createExamShortLink({ apiBase, examId });
            await handleCopy(res.shortUrl, "Short link copied");
        }
        catch (err) {
            setToast({ message: err?.message ?? "Short link failed", tone: "error" });
        }
        finally {
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
            const previewSeed = (normalizedRequestBody.seed ?? (draft.seed ? draft.seed.trim() : "")) ||
                `preview:${normalizedRequestBody.subject}:${JSON.stringify(composition)}`;
            const questions = buildPreviewQuestions(bank, composition, normalizedRequestBody.policy, previewSeed);
            setPreviewQuestions(questions);
        }
        catch (err) {
            setPreviewQuestions([]);
            setPreviewError(err?.message ?? "Failed to build preview");
        }
        finally {
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
            const template = {
                subject: normalizedRequestBody.subject,
                composition: normalizedRequestBody.composition,
                policy: normalizedRequestBody.policy,
                codes: normalizedRequestBody.codes,
                expiresAt: normalizedRequestBody.expiresAt ?? null,
                visibility: normalizedRequestBody.visibility ?? "private"
            };
            localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(template));
            setLastTemplate(template);
        }
        catch (err) {
            const apiError = err;
            const status = apiError.status ?? 0;
            const message = apiError.message ?? "Unknown error";
            setSubmitError(`Create failed (${status}). ${message}`);
        }
        finally {
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
            if (cancelled)
                return;
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
        if (!editExamId)
            return;
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
        }
        catch (err) {
            const apiError = err;
            const status = apiError.status ?? 0;
            const message = apiError.message ?? "Unknown error";
            setSubmitError(`Update failed (${status}). ${message}`);
        }
        finally {
            setIsSubmitting(false);
        }
    };
    const handleReset = () => {
        reset();
        setResult(null);
        setSubmitError(null);
    };
    const applyTemplate = (template) => {
        setDraft((prev) => ({
            ...prev,
            subject: template.subject,
            composition: template.composition.map((row) => ({ ...row })),
            policy: { ...template.policy },
            codes: template.codes ?? [],
            codesEnabled: Boolean((template.codes && template.codes.length > 0) ||
                template.policy.requireSubmitCode ||
                template.policy.requireViewCode),
            expiresEnabled: Boolean(template.expiresAt),
            expiresAtLocal: template.expiresAt ? toLocalDateTimeInput(template.expiresAt) : "",
            visibility: template.visibility ?? "private",
            autoSeed: true,
            seed: ""
        }));
    };
    const handleUseLastTemplate = () => {
        if (!lastTemplate)
            return;
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
        }
        catch (err) {
            const apiError = err;
            const status = apiError.status ?? 0;
            const message = apiError.message ?? "Unknown error";
            setTemplateError(`Save failed (${status}). ${message}`);
        }
    };
    const handleUseSavedTemplate = (template) => {
        setTemplateError(null);
        applyTemplate(template.template);
        setToast({ message: "Loaded saved template", tone: "success" });
    };
    const handleDeleteTemplate = async (template) => {
        if (!apiBase) {
            setTemplateError("API Base URL is required.");
            return;
        }
        if (!window.confirm(`Delete template "${template.name}"?`))
            return;
        try {
            await deleteTemplate({ apiBase, templateId: template.templateId });
            setSavedTemplates((prev) => prev.filter((item) => item.templateId !== template.templateId));
            setToast({ message: "Template deleted", tone: "success" });
        }
        catch (err) {
            const apiError = err;
            const status = apiError.status ?? 0;
            const message = apiError.message ?? "Unknown error";
            setTemplateError(`Delete failed (${status}). ${message}`);
        }
    };
    useEffect(() => {
        let cancelled = false;
        if (!apiBase)
            return;
        setTemplatesLoading(true);
        listTemplates({ apiBase })
            .then((res) => {
            if (cancelled)
                return;
            setSavedTemplates(res.items ?? []);
        })
            .catch((err) => {
            if (cancelled)
                return;
            setTemplateError(err?.message ?? "Failed to load templates");
        })
            .finally(() => {
            if (cancelled)
                return;
            setTemplatesLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [apiBase]);
    useEffect(() => {
        if (!editExamId || !apiBase)
            return;
        let cancelled = false;
        getAdminExam({ apiBase, examId: editExamId })
            .then((res) => {
            if (cancelled)
                return;
            if (res.exam.deletedAt) {
                setSubmitError("This exam is deleted and cannot be edited.");
                return;
            }
            setEditHasSubmissions(res.hasSubmissions);
            const template = {
                subject: res.exam.subject,
                composition: res.exam.composition,
                policy: res.exam.policy,
                expiresAt: res.exam.expiresAt ?? null,
                visibility: res.exam.visibility ?? "private"
            };
            applyTemplate(template);
            setDraft((prev) => ({ ...prev, title: res.exam.title ?? "" }));
        })
            .catch((err) => {
            if (cancelled)
                return;
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
            const res = await getExamTemplate({ apiBase, examId: templateExamId.trim() });
            const template = {
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
        }
        catch (err) {
            const apiError = err;
            const status = apiError.status ?? 0;
            const message = apiError.message ?? "Unknown error";
            setTemplateError(`Load failed (${status}). ${message}`);
        }
        finally {
            setTemplateLoading(false);
        }
    };
    return (_jsx(AdminAuthGate, { children: _jsxs("div", { children: [_jsx("div", { className: "sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur", children: _jsxs("div", { className: "mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-end gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => validate(), disabled: isSubmitting, children: "Validate" }), _jsx(Button, { type: "button", variant: "secondary", onClick: handleOpenPreview, disabled: isSubmitting, children: "Preview exam" }), activeExamId ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => handleCopyExamLink(activeExamId, normalizedRequestBody.subject), disabled: isSubmitting, children: "Copy link" })) : null, activeExamId ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => window.open(buildExamLink(normalizedRequestBody.subject, activeExamId), "_blank"), disabled: isSubmitting, children: "Open" })) : null, activeExamId ? (_jsx(Button, { type: "button", variant: "secondary", onClick: () => handleCopyShortLink(activeExamId), disabled: isSubmitting || shortLinkLoading, children: shortLinkLoading ? "Copying..." : "Copy short link" })) : null, _jsx(Button, { type: "button", variant: "secondary", onClick: handleReset, disabled: isSubmitting, children: "Reset" }), _jsx(Button, { type: "button", onClick: editExamId ? handleUpdate : handleCreate, disabled: !canCreate, children: isSubmitting ? (editExamId ? "Updating..." : "Creating...") : editExamId ? "Update Exam" : "Create Exam" })] }) }), _jsxs(PageShell, { maxWidth: "6xl", className: "py-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-neutral-900 dark:text-neutral-100", children: editExamId ? "Edit Exam" : "Create Exam" }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300", children: [_jsx(Badge, { tone: connectionStatus === "connected"
                                                ? "success"
                                                : connectionStatus === "error"
                                                    ? "error"
                                                    : "muted", children: connectionStatus === "connected" ? "Connected" : "Not connected" }), _jsxs("span", { className: "text-xs", children: ["/", "/admin/exams"] })] })] }), submitError ? _jsx(Alert, { tone: "error", children: submitError }) : null, editExamId ? (_jsx(Alert, { tone: editHasSubmissions ? "warn" : "info", children: editHasSubmissions
                                ? "This exam already has submissions. Updating will not change past submissions."
                                : "Editing an existing exam. Changes apply immediately to future attempts." })) : null, _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-neutral-900 dark:text-neutral-100", children: "Steps" }), _jsx("div", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Fill out each section below. The preview updates live." })] }), _jsx(StepIndicator, { steps: stepIndicatorSteps })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-neutral-900 dark:text-neutral-100", children: "Template" }), _jsx("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Reuse settings from a previous exam to avoid re-entering fields." })] }), templateError ? _jsx(Alert, { tone: "error", children: templateError }) : null, _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "template-exam-id", children: "Load by exam ID" }), _jsx(Input, { id: "template-exam-id", value: templateExamId, onChange: (e) => setTemplateExamId(e.target.value), placeholder: "exam-uuid" })] }), _jsxs("div", { className: "flex items-end gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: handleLoadTemplate, disabled: templateLoading, children: templateLoading ? "Loading..." : "Load template" }), lastTemplate ? (_jsx(Button, { type: "button", onClick: handleUseLastTemplate, children: "Use last template" })) : null] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "template-name", children: "Template name" }), _jsx(Input, { id: "template-name", value: templateName, onChange: (e) => setTemplateName(e.target.value), placeholder: "Midterm template" })] }), _jsx("div", { className: "flex items-end", children: _jsx(Button, { type: "button", variant: "secondary", onClick: handleSaveTemplate, disabled: !templateName.trim(), children: "Save current as template" }) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", children: "Saved templates" }), templatesLoading ? (_jsx("div", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Loading templates..." })) : savedTemplates.length ? (_jsx("div", { className: "space-y-2 text-xs", children: savedTemplates.map((item) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium text-neutral-900 dark:text-neutral-100", children: item.name }), _jsx("div", { className: "text-neutral-500 dark:text-neutral-400", children: formatUpdatedAt(item.updatedAt ?? item.createdAt) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => handleUseSavedTemplate(item), children: "Use" }), _jsx(Button, { type: "button", size: "sm", variant: "ghost", onClick: () => handleDeleteTemplate(item), children: "Delete" })] })] }, item.templateId))) })) : (_jsx("div", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "No saved templates yet." }))] }), _jsx("div", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Templates are stored on the server for admin access." })] }), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-neutral-900 dark:text-neutral-100", children: "Basics" }), _jsx("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Choose the subject and (optionally) an expiry time." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "subject", children: "Subject" }), _jsx(Select, { id: "subject", value: draft.subject, onChange: (e) => setDraft({ ...draft, subject: e.target.value }), hasError: Boolean(errors["subject"]), "aria-describedby": errors["subject"] ? "subject-error" : undefined, children: _jsx("option", { value: "discrete-math", children: "Discrete Math" }) }), errors["subject"] ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: "subject-error", children: errors["subject"] })) : null] }), _jsx("div", { className: "space-y-2", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", children: "Public listing" }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Public exams appear on the homepage until they expire." })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300", children: [_jsx(Switch, { id: "visibility-toggle", checked: draft.visibility === "public", onChange: (value) => setDraft({ ...draft, visibility: value ? "public" : "private" }) }), _jsx("label", { htmlFor: "visibility-toggle", children: "Public" })] })] }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "exam-title", children: "Optional label/title" }), _jsx(Input, { id: "exam-title", value: draft.title, onChange: (e) => setDraft({ ...draft, title: e.target.value }), placeholder: "Midterm A" }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Displayed on the exam page and stored with the exam." })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", children: "Expires at" }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Optional expiry timestamp (UTC sent to backend)." })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300", children: [_jsx(Switch, { id: "expires-toggle", checked: draft.expiresEnabled, onChange: (value) => setDraft({ ...draft, expiresEnabled: value }) }), _jsx("label", { htmlFor: "expires-toggle", children: "Enable expiry" })] })] }), draft.expiresEnabled ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Input, { id: "expires-at", type: "datetime-local", value: draft.expiresAtLocal, onChange: (e) => setDraft({ ...draft, expiresAtLocal: e.target.value }), hasError: Boolean(errors["expiresAt"]), "aria-describedby": errors["expiresAt"] ? "expires-error" : undefined }), errors["expiresAt"] ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: "expires-error", children: errors["expiresAt"] })) : null, _jsxs("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: ["ISO preview: ", expiresIso || "—"] })] })) : null] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-neutral-900 dark:text-neutral-100", children: "Access Rules" }), _jsx("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Configure sign-in, codes, and when solutions appear." })] }), _jsx(PolicyCard, { policy: draft.policy, onChange: (policy) => setDraft({ ...draft, policy }), errors: errors }), _jsx(CodesEditor, { codesEnabled: draft.codesEnabled, codes: draft.codes, policy: draft.policy, onCodesEnabledChange: (value) => setDraft({ ...draft, codesEnabled: value, codes: value ? draft.codes : [] }), onCodesChange: (codes) => setDraft({ ...draft, codes }) })] }), _jsxs("div", { id: "composition-section", className: "space-y-4", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-neutral-900 dark:text-neutral-100", children: "Question bank" }), _jsx("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Load the latest bank to populate topics and counts." })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-[1fr_auto] items-end", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "bank-subject", children: "Available bank subjects" }), _jsxs(Select, { id: "bank-subject", value: bankSubject, onChange: (e) => {
                                                                                setBankSubject(e.target.value);
                                                                                setBankStats(null);
                                                                            }, disabled: bankSubjects.length === 0, children: [bankSubjects.length === 0 ? (_jsx("option", { value: "", children: "No banks found" })) : null, bankSubjects.length > 0
                                                                                    ? bankSubjects.map((subject) => (_jsx("option", { value: subject, children: subject }, subject)))
                                                                                    : null] })] }), _jsx(Button, { type: "button", variant: "secondary", onClick: loadSelectedBank, disabled: bankLoading || !bankSubject, children: bankLoading ? "Loading…" : "Load bank" })] }), bankLoadError ? _jsx(Alert, { tone: "error", children: bankLoadError }) : null, bankStats ? (_jsxs(Alert, { tone: "info", children: ["Loaded ", bankStats.subject, " bank with ", bankStats.total, " questions across ", bankStats.topics.length, " topics", bankStats.topics.length ? ` (${topicListFriendly(bankStats.topics)})` : "", "."] })) : null] }), _jsx(CompositionBuilder, { composition: draft.composition, onChange: (next) => setDraft({ ...draft, composition: next }), errors: errors, bankStats: bankStats })] }), _jsx(VersionsCard, { policy: draft.policy, onChange: (policy) => setDraft({ ...draft, policy }), errors: errors }), _jsxs(Card, { className: "space-y-2", children: [_jsx("h2", { className: "text-base font-semibold text-neutral-900 dark:text-neutral-100", children: "Review & Create" }), _jsxs("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: ["Review the request preview, then click ", _jsx("strong", { children: "Create Exam" }), " in the header."] }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "The backend request body is shown in the preview; the title is included when provided." })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsx(ConnectionCard, { apiBase: apiBase, onApiBaseChange: updateApiBase, hideAdminToken: true, hideTestButton: true, onTestConnection: handleTestConnection, status: connectionStatus, statusMessage: connectionMessage, lastError: connectionError }), _jsx(SeedCard, { autoSeed: draft.autoSeed, seed: draft.seed, onAutoSeedChange: (value) => setDraft({ ...draft, autoSeed: value }), onSeedChange: (value) => setDraft({ ...draft, seed: value }), error: errors["seed"] }), _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-neutral-900 dark:text-neutral-100", children: "Student will see" }), _jsx("div", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "A quick summary of the student experience." })] }), _jsxs("div", { className: "grid gap-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-neutral-600 dark:text-neutral-300", children: "Sign-in" }), _jsx("span", { className: "font-medium text-neutral-900 dark:text-neutral-100", children: studentSignIn })] }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-neutral-600 dark:text-neutral-300", children: "Access codes" }), _jsx("span", { className: "font-medium text-neutral-900 dark:text-neutral-100", children: studentCodes })] }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-neutral-600 dark:text-neutral-300", children: "Solutions" }), _jsx("span", { className: "font-medium text-neutral-900 dark:text-neutral-100", children: studentSolutions })] })] })] }), _jsx("div", { className: "lg:hidden", children: _jsx(RequestPreview, { body: normalizedRequestBody, warnings: warnings, errors: errors, apiBase: apiBase, includeTokenInCurl: false, sessionAuth: true, onIncludeTokenInCurlChange: () => { }, onCopyJson: (text) => handleCopy(text, "JSON copied"), onCopyCurl: (text) => handleCopy(text, "curl copied"), collapsible: true, idPrefix: "request-preview-mobile" }) }), _jsx("div", { className: "hidden lg:block", children: _jsx(RequestPreview, { body: normalizedRequestBody, warnings: warnings, errors: errors, apiBase: apiBase, includeTokenInCurl: false, sessionAuth: true, onIncludeTokenInCurlChange: () => { }, onCopyJson: (text) => handleCopy(text, "JSON copied"), onCopyCurl: (text) => handleCopy(text, "curl copied"), idPrefix: "request-preview-desktop" }) }), result ? (_jsx(ResultCard, { result: result, onCreateAnother: handleReset, onCopyShortLink: activeExamId ? () => handleCopyShortLink(activeExamId) : undefined, shortLinkLoading: shortLinkLoading })) : null] })] }), previewOpen ? (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: () => setPreviewOpen(false) }), _jsxs(Card, { className: "relative w-full max-w-5xl max-h-[90vh] overflow-auto space-y-4", padding: "md", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "Exam preview" }), _jsx("div", { className: "text-xs text-textMuted", children: "Built from the latest public bank; per-student shuffle follows the current policy and seed." })] }), _jsx(Button, { type: "button", variant: "ghost", onClick: () => setPreviewOpen(false), children: "Close" })] }), previewError ? _jsx(Alert, { tone: "error", children: previewError }) : null, previewLoading ? (_jsx("div", { className: "text-sm text-textMuted", children: "Loading preview..." })) : previewQuestions.length ? (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "text-xs text-textMuted", children: ["Questions: ", previewQuestions.length] }), previewQuestions.map((q, idx) => (_jsx("div", { children: q.type === "mcq-single" ? (_jsx(McqQuestion, { index: idx, question: q, answer: typeof previewAnswers[q.uid] === "string" ? previewAnswers[q.uid] : "", onChange: (uid, val) => setPreviewAnswers((prev) => ({ ...prev, [uid]: val })), showSolution: false })) : q.type === "fill-blank" ? (_jsx(FillBlankQuestion, { index: idx, question: q, answer: previewAnswers[q.uid], onChange: (uid, val) => setPreviewAnswers((prev) => ({ ...prev, [uid]: val })), showSolution: false })) : null }, q.uid)))] })) : (_jsx("div", { className: "text-sm text-textMuted", children: "No preview questions yet." }))] })] })) : null, toast ? (_jsx("div", { className: "fixed right-4 top-4 z-50 flex flex-col gap-2", children: _jsx(Toast, { message: toast.message, tone: toast.tone, onDismiss: () => setToast(null) }) })) : null] })] }) }));
}
