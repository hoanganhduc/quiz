import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { createExam, healthCheck } from "../../api/admin";
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
    const { draft, setDraft, errors, warnings, normalizedRequestBody, validate, reset } = useExamDraft();
    const [connectionStatus, setConnectionStatus] = useState("idle");
    const [connectionMessage, setConnectionMessage] = useState();
    const [connectionError, setConnectionError] = useState();
    const [submitError, setSubmitError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const [toast, setToast] = useState(null);
    const expiresIso = useMemo(() => {
        if (!draft.expiresEnabled || !draft.expiresAtLocal)
            return "";
        const date = new Date(draft.expiresAtLocal);
        if (Number.isNaN(date.getTime()))
            return "Invalid date";
        return date.toISOString();
    }, [draft.expiresEnabled, draft.expiresAtLocal]);
    const canCreate = !isSubmitting && Object.keys(errors).length === 0;
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
    const handleCopy = async (text, message) => {
        try {
            await navigator.clipboard.writeText(text);
            setToast({ message, tone: "success" });
        }
        catch {
            setToast({ message: "Copy failed. Check browser permissions.", tone: "error" });
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
            setResult(response);
            setToast({ message: "Exam created", tone: "success" });
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
    const handleReset = () => {
        reset();
        setResult(null);
        setSubmitError(null);
    };
    return (_jsx(AdminAuthGate, { children: _jsxs("div", { children: [_jsx("div", { className: "sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur", children: _jsxs("div", { className: "mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-neutral-900 dark:text-neutral-100", children: "Create Exam" }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300", children: [_jsx(Badge, { tone: connectionStatus === "connected"
                                                    ? "success"
                                                    : connectionStatus === "error"
                                                        ? "error"
                                                        : "muted", children: connectionStatus === "connected" ? "Connected" : "Not connected" }), _jsxs("span", { className: "text-xs", children: ["/", "/admin/exams"] })] })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", onClick: () => validate(), disabled: isSubmitting, children: "Validate" }), _jsx(Button, { type: "button", variant: "secondary", onClick: handleReset, disabled: isSubmitting, children: "Reset" }), _jsx(Button, { type: "button", onClick: handleCreate, disabled: !canCreate, children: isSubmitting ? "Creating..." : "Create Exam" })] })] }) }), _jsxs(PageShell, { maxWidth: "6xl", className: "py-6 space-y-6", children: [submitError ? _jsx(Alert, { tone: "error", children: submitError }) : null, _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-neutral-900 dark:text-neutral-100", children: "Steps" }), _jsx("div", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Fill out each section below. The preview updates live." })] }), _jsx(StepIndicator, { steps: stepIndicatorSteps })] }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-neutral-900 dark:text-neutral-100", children: "Basics" }), _jsx("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Choose the subject and (optionally) an expiry time." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "subject", children: "Subject" }), _jsx(Select, { id: "subject", value: draft.subject, onChange: (e) => setDraft({ ...draft, subject: e.target.value }), hasError: Boolean(errors["subject"]), "aria-describedby": errors["subject"] ? "subject-error" : undefined, children: _jsx("option", { value: "discrete-math", children: "Discrete Math" }) }), errors["subject"] ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: "subject-error", children: errors["subject"] })) : null] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", htmlFor: "exam-title", children: "Optional label/title" }), _jsx(Input, { id: "exam-title", value: draft.title, onChange: (e) => setDraft({ ...draft, title: e.target.value }), placeholder: "Midterm A (UI only)" }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "UI-only, not sent to the backend." })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-neutral-700 dark:text-neutral-200", children: "Expires at" }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "Optional expiry timestamp (UTC sent to backend)." })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300", children: [_jsx(Switch, { id: "expires-toggle", checked: draft.expiresEnabled, onChange: (value) => setDraft({ ...draft, expiresEnabled: value }) }), _jsx("label", { htmlFor: "expires-toggle", children: "Enable expiry" })] })] }), draft.expiresEnabled ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Input, { id: "expires-at", type: "datetime-local", value: draft.expiresAtLocal, onChange: (e) => setDraft({ ...draft, expiresAtLocal: e.target.value }), hasError: Boolean(errors["expiresAt"]), "aria-describedby": errors["expiresAt"] ? "expires-error" : undefined }), errors["expiresAt"] ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: "expires-error", children: errors["expiresAt"] })) : null, _jsxs("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: ["ISO preview: ", expiresIso || "—"] })] })) : null] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-semibold text-neutral-900 dark:text-neutral-100", children: "Access Rules" }), _jsx("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "Configure sign-in, codes, and when solutions appear." })] }), _jsx(PolicyCard, { policy: draft.policy, onChange: (policy) => setDraft({ ...draft, policy }), errors: errors }), _jsx(CodesEditor, { codesEnabled: draft.codesEnabled, codes: draft.codes, policy: draft.policy, onCodesEnabledChange: (value) => setDraft({ ...draft, codesEnabled: value, codes: value ? draft.codes : [] }), onCodesChange: (codes) => setDraft({ ...draft, codes }) })] }), _jsx("div", { id: "composition-section", children: _jsx(CompositionBuilder, { composition: draft.composition, onChange: (next) => setDraft({ ...draft, composition: next }), errors: errors }) }), _jsx(VersionsCard, { policy: draft.policy, onChange: (policy) => setDraft({ ...draft, policy }), errors: errors }), _jsxs(Card, { className: "space-y-2", children: [_jsx("h2", { className: "text-base font-semibold text-neutral-900 dark:text-neutral-100", children: "Review & Create" }), _jsxs("p", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: ["Review the request preview, then click ", _jsx("strong", { children: "Create Exam" }), " in the header."] }), _jsx("p", { className: "text-xs text-neutral-500 dark:text-neutral-400", children: "The backend request body is shown in the preview; UI-only fields like the title are not included." })] })] }), _jsxs("div", { className: "space-y-6", children: [_jsx(ConnectionCard, { apiBase: apiBase, onApiBaseChange: updateApiBase, hideAdminToken: true, hideTestButton: true, onTestConnection: handleTestConnection, status: connectionStatus, statusMessage: connectionMessage, lastError: connectionError }), _jsx(SeedCard, { autoSeed: draft.autoSeed, seed: draft.seed, onAutoSeedChange: (value) => setDraft({ ...draft, autoSeed: value }), onSeedChange: (value) => setDraft({ ...draft, seed: value }), error: errors["seed"] }), _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-neutral-900 dark:text-neutral-100", children: "Student will see" }), _jsx("div", { className: "text-sm text-neutral-600 dark:text-neutral-300", children: "A quick summary of the student experience." })] }), _jsxs("div", { className: "grid gap-2 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-neutral-600 dark:text-neutral-300", children: "Sign-in" }), _jsx("span", { className: "font-medium text-neutral-900 dark:text-neutral-100", children: studentSignIn })] }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-neutral-600 dark:text-neutral-300", children: "Access codes" }), _jsx("span", { className: "font-medium text-neutral-900 dark:text-neutral-100", children: studentCodes })] }), _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("span", { className: "text-neutral-600 dark:text-neutral-300", children: "Solutions" }), _jsx("span", { className: "font-medium text-neutral-900 dark:text-neutral-100", children: studentSolutions })] })] })] }), _jsx("div", { className: "lg:hidden", children: _jsx(RequestPreview, { body: normalizedRequestBody, warnings: warnings, errors: errors, apiBase: apiBase, includeTokenInCurl: false, sessionAuth: true, onIncludeTokenInCurlChange: () => { }, onCopyJson: (text) => handleCopy(text, "JSON copied"), onCopyCurl: (text) => handleCopy(text, "curl copied"), collapsible: true, idPrefix: "request-preview-mobile" }) }), _jsx("div", { className: "hidden lg:block", children: _jsx(RequestPreview, { body: normalizedRequestBody, warnings: warnings, errors: errors, apiBase: apiBase, includeTokenInCurl: false, sessionAuth: true, onIncludeTokenInCurlChange: () => { }, onCopyJson: (text) => handleCopy(text, "JSON copied"), onCopyCurl: (text) => handleCopy(text, "curl copied"), idPrefix: "request-preview-desktop" }) }), result ? _jsx(ResultCard, { result: result, onCreateAnother: handleReset }) : null] })] }), toast ? (_jsx("div", { className: "fixed right-4 top-4 z-50 flex flex-col gap-2", children: _jsx(Toast, { message: toast.message, tone: toast.tone, onDismiss: () => setToast(null) }) })) : null] })] }) }));
}

