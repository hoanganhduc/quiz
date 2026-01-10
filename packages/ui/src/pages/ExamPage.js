import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getExamBank, getExamConfig, getSession, githubLoginUrl, googleLoginUrl, loginAnonymous, submitExam } from "../api";
import { clearDraft, loadDraft, saveDraft } from "../storage/drafts";
import clsx from "clsx";
import { StickyHeader } from "../components/ui/StickyHeader";
import { Card } from "../components/ui/Card";
import { Accordion } from "../components/ui/Accordion";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Badge } from "../components/ui/Badge";
import { McqQuestion } from "../components/McqQuestion";
import { FillBlankQuestion } from "../components/FillBlankQuestion";
import { FloatingActionBar, FloatingActionsRow, FloatingPrimaryButton } from "../components/ui/FloatingActionBar";
import { StepIndicator } from "../components/ui/StepIndicator";
import { PageShell } from "../components/layout/PageShell";
export function ExamPage({ session, setSession }) {
    const { examId = "" } = useParams();
    const [config, setConfig] = useState(null);
    const [bank, setBank] = useState(null);
    const [answers, setAnswers] = useState({});
    const [versionId, setVersionId] = useState(null);
    const [submitCode, setSubmitCode] = useState("");
    const [viewCode, setViewCode] = useState("");
    const [submission, setSubmission] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [restored, setRestored] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [clearAnswersOpen, setClearAnswersOpen] = useState(false);
    const [draftNotice, setDraftNotice] = useState(null);
    const [hasDraft, setHasDraft] = useState(false);
    const [timeRemainingMs, setTimeRemainingMs] = useState(null);
    const [timeStartIso, setTimeStartIso] = useState(null);
    const draftNoticeTimerRef = useRef(null);
    const timeExpiredNotifiedRef = useRef(false);
    useEffect(() => {
        setAnswers({});
        setVersionId(null);
        setBank(null);
        setSubmission(null);
        setStatus(null);
        setLoading(true);
        setRestored(false);
        setTimeRemainingMs(null);
        setTimeStartIso(null);
        timeExpiredNotifiedRef.current = false;
        const loadConfig = async () => {
            try {
                const cfg = await getExamConfig(examId);
                setConfig(cfg);
                const needsPerStudentSession = cfg.policy.versioningMode === "per_student" && cfg.policy.authMode !== "required";
                if (needsPerStudentSession) {
                    try {
                        const sess = await getSession();
                        if (sess) {
                            setSession(sess);
                        }
                        else {
                            await loginAnonymous();
                            const anonSess = await getSession();
                            if (anonSess)
                                setSession(anonSess);
                        }
                    }
                    catch {
                        // silent, still allow fetch to continue
                    }
                }
            }
            catch (err) {
                setStatus({ tone: "error", text: err.message });
            }
            finally {
                setLoading(false);
            }
        };
        void loadConfig();
    }, [examId, setSession]);
    useEffect(() => {
        const storedView = sessionStorage.getItem(`exam:viewCode:${examId}`);
        const storedSubmit = sessionStorage.getItem(`exam:submitCode:${examId}`);
        setViewCode(storedView ?? "");
        setSubmitCode(storedSubmit ?? "");
    }, [examId]);
    const requireViewCode = config?.policy.requireViewCode;
    const requireSubmitCode = config?.policy.requireSubmitCode;
    const signedIn = session ? session.provider === "github" || session.provider === "google" : false;
    const authMode = config?.policy.authMode ?? "none";
    const authSatisfied = authMode !== "required" || signedIn;
    const codesRequired = !!requireViewCode || !!requireSubmitCode;
    const codesEntered = (!requireViewCode || !!viewCode) && (!requireSubmitCode || !!submitCode);
    const canShare = config?.visibility === "public" && authMode === "none" && !codesRequired;
    const examTitle = (config === null || config === void 0 ? void 0 : config.title) ? config.title : `Exam ${config?.examId ?? examId}`;
    const examLink = config
        ? (() => {
            const rawBase = import.meta.env.VITE_BASE_URL ?? "/";
            const trimmed = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
            const base = trimmed === "/" ? "" : trimmed;
            return `${window.location.origin}${base}/#/exam/${encodeURIComponent(config.subject)}/${encodeURIComponent(config.examId)}`;
        })()
        : "";
    const totalQuestions = bank?.questions.length ?? 0;
    const answeredCount = bank
        ? bank.questions.filter((q) => {
            const v = answers[q.uid];
            if (q.type === "fill-blank") {
                return Array.isArray(v)
                    ? v.some((x) => x.trim() !== "")
                    : typeof v === "string"
                        ? v.trim() !== ""
                        : false;
            }
            return typeof v === "string" && v !== "";
        }).length
        : 0;
    const remainingCount = Math.max(0, totalQuestions - answeredCount);
    const completionPct = totalQuestions === 0 ? 0 : (answeredCount / totalQuestions) * 100;
    const timeLimitMinutes = config?.policy.timeLimitMinutes;
    const timeExpired = timeRemainingMs !== null && timeRemainingMs <= 0;
    useEffect(() => {
        if (!examId)
            return;
        const key = `exam:viewCode:${examId}`;
        if (viewCode) {
            sessionStorage.setItem(key, viewCode);
        }
        else {
            sessionStorage.removeItem(key);
        }
    }, [examId, viewCode]);
    useEffect(() => {
        if (!examId)
            return;
        const key = `exam:submitCode:${examId}`;
        if (submitCode) {
            sessionStorage.setItem(key, submitCode);
        }
        else {
            sessionStorage.removeItem(key);
        }
    }, [examId, submitCode]);
    const formatTimeRemaining = (ms) => {
        if (ms <= 0)
            return "Time expired";
        const totalSeconds = Math.ceil(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (n) => n.toString().padStart(2, "0");
        return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
    };
    useEffect(() => {
        if (!bank || !versionId || !timeLimitMinutes) {
            setTimeRemainingMs(null);
            setTimeStartIso(null);
            timeExpiredNotifiedRef.current = false;
            return;
        }
        const storageKey = `exam-start:${examId}:${versionId}`;
        const existing = localStorage.getItem(storageKey);
        const startedAt = existing || new Date().toISOString();
        if (!existing) {
            localStorage.setItem(storageKey, startedAt);
        }
        setTimeStartIso(startedAt);
    }, [bank, examId, timeLimitMinutes, versionId]);
    useEffect(() => {
        if (!timeStartIso || !timeLimitMinutes)
            return;
        const startMs = Date.parse(timeStartIso);
        if (Number.isNaN(startMs))
            return;
        const limitMs = timeLimitMinutes * 60 * 1000;
        const tick = () => {
            const remaining = Math.max(0, startMs + limitMs - Date.now());
            setTimeRemainingMs(remaining);
            if (remaining <= 0 && !timeExpiredNotifiedRef.current) {
                timeExpiredNotifiedRef.current = true;
                setStatus({ tone: "warn", text: "Time limit reached. Submissions are closed." });
            }
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [timeStartIso, timeLimitMinutes]);
    useEffect(() => {
        if (!versionId)
            return;
        const draft = loadDraft(examId, versionId);
        if (draft?.answers) {
            setAnswers(draft.answers);
            setRestored(true);
            setHasDraft(true);
            setDraftNotice("Draft restored");
        }
        else {
            setHasDraft(false);
        }
    }, [examId, versionId]);
    useEffect(() => {
        if (!versionId || !bank)
            return;
        const timer = setTimeout(() => {
            saveDraft(examId, versionId, answers);
            setHasDraft(true);
            if (draftNoticeTimerRef.current) {
                window.clearTimeout(draftNoticeTimerRef.current);
            }
            setDraftNotice("Saved just now");
            draftNoticeTimerRef.current = window.setTimeout(() => setDraftNotice(null), 2500);
        }, 400);
        return () => clearTimeout(timer);
    }, [answers, examId, versionId, bank]);
    useEffect(() => {
        if (!confirmOpen && !clearConfirmOpen && !clearAnswersOpen)
            return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                setConfirmOpen(false);
                setClearConfirmOpen(false);
                setClearAnswersOpen(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [confirmOpen, clearConfirmOpen, clearAnswersOpen]);
    useEffect(() => {
        if (!config || bank)
            return;
        const autoLoad = sessionStorage.getItem(`exam:autoLoad:${examId}`) === "1";
        if (!autoLoad)
            return;
        if (authMode === "required" && !signedIn)
            return;
        if (requireViewCode && !viewCode)
            return;
        void handleBank();
    }, [authMode, bank, config, examId, requireViewCode, signedIn, viewCode]);
    const handleBank = async () => {
        if (!config)
            return;
        if (requireViewCode && !viewCode) {
            setStatus({ tone: "warn", text: "Enter view code to load questions." });
            return;
        }
        setStatus(null);
        try {
            const data = await getExamBank(examId, requireViewCode ? viewCode : undefined);
            setRestored(false);
            setAnswers({});
            setVersionId(data.version?.versionId ?? "fixed");
            setBank(data);
            sessionStorage.setItem(`exam:autoLoad:${examId}`, "1");
        }
        catch (err) {
            const msg = err?.message ?? "Failed to load questions";
            const tone = msg.includes("Unauthorized") ? "error" : msg.includes("Forbidden") ? "warn" : "error";
            setStatus({ tone, text: msg });
        }
    };
    const handleSubmit = async () => {
        if (!bank) {
            setStatus({ tone: "warn", text: "Load questions first." });
            return;
        }
        if (timeExpired) {
            setStatus({ tone: "warn", text: "Time limit reached. Submissions are closed." });
            return;
        }
        if (requireSubmitCode && !submitCode) {
            setStatus({ tone: "warn", text: "Enter submit code before submitting." });
            return;
        }
        setStatus(null);
        try {
            const res = await submitExam(examId, answers, requireSubmitCode ? submitCode : undefined);
            setSubmission(res.submission);
            setStatus({ tone: "success", text: "Submission recorded." });
            if (versionId)
                clearDraft(examId, versionId);
            await handleBank(); // refresh for solutions if always
        }
        catch (err) {
            const msg = err?.message ?? "Submit failed";
            setStatus({ tone: "error", text: msg });
        }
    };
    const handleGithub = () => {
        window.location.href = githubLoginUrl(window.location.href);
    };
    const handleGoogle = () => {
        window.location.href = googleLoginUrl(window.location.href);
    };
    const handleClearDraft = () => {
        if (!versionId)
            return;
        clearDraft(examId, versionId);
        setAnswers({});
        setRestored(false);
        setHasDraft(false);
        setDraftNotice("Draft cleared");
    };
    const handleClearAllAnswers = () => {
        if (!bank || submission)
            return;
        if (versionId)
            clearDraft(examId, versionId);
        setAnswers({});
        setRestored(false);
        setHasDraft(false);
        setDraftNotice("Answers cleared");
    };
    const handleSaveForLater = () => {
        if (!versionId || !bank) {
            setStatus({ tone: "warn", text: "Load questions first." });
            return;
        }
        saveDraft(examId, versionId, answers);
        setHasDraft(true);
        if (draftNoticeTimerRef.current) {
            window.clearTimeout(draftNoticeTimerRef.current);
        }
        setDraftNotice("Saved for later");
        draftNoticeTimerRef.current = window.setTimeout(() => setDraftNotice(null), 2500);
        setStatus({ tone: "success", text: "Draft saved. You can submit later." });
    };
    const handleShare = async () => {
        if (!canShare || !examLink)
            return;
        try {
            if (navigator.share) {
                await navigator.share({
                    title: examTitle,
                    url: examLink
                });
                return;
            }
            await navigator.clipboard.writeText(examLink);
            setStatus({ tone: "success", text: "Exam link copied." });
        }
        catch (err) {
            if (err?.name === "AbortError")
                return;
            setStatus({ tone: "error", text: err?.message ?? "Share failed." });
        }
    };
    const openClearDraftConfirm = () => {
        if (!versionId || !hasDraft)
            return;
        setClearConfirmOpen(true);
    };
    const openClearAnswersConfirm = () => {
        if (!bank || submission)
            return;
        setClearAnswersOpen(true);
    };
    const reviewUnanswered = () => {
        if (!bank) {
            setStatus({ tone: "warn", text: "Load questions first." });
            return;
        }
        const idx = bank.questions.findIndex((q) => !answers[q.uid]);
        if (idx < 0) {
            setStatus({ tone: "success", text: "All questions answered." });
            return;
        }
        document.getElementById(`q-${idx + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        setStatus({ tone: "info", text: `Reviewing unanswered question ${idx + 1}.` });
    };
    const submitDisabled = (totalQuestions > 0 ? answeredCount === 0 : false) || timeExpired;
    const showSolutions = submission ? true : false;
    const loadDisabled = (authMode === "required" && !signedIn) || (requireViewCode && !viewCode);
    const openSubmitConfirm = () => {
        if (submitDisabled) {
            if (timeExpired) {
                setStatus({ tone: "warn", text: "Time limit reached. Submissions are closed." });
            }
            return;
        }
        setConfirmOpen(true);
    };
    const startSteps = (() => {
        const steps = [];
        const authStep = {
            title: "Sign in",
            description: authMode === "required"
                ? "Required for this exam."
                : authMode === "optional"
                    ? "Optional — helps save your history and keep a consistent per-student version."
                    : "Skipped for this exam.",
            status: authMode === "required" ? (signedIn ? "done" : "current") : authMode === "optional" ? (signedIn ? "done" : "optional") : "done"
        };
        steps.push(authStep);
        if (codesRequired) {
            steps.push({
                title: "Enter access code",
                description: requireViewCode && requireSubmitCode
                    ? "View code unlocks questions; submit code is required to submit."
                    : requireViewCode
                        ? "View code unlocks the questions."
                        : "Submit code is required only when you submit.",
                status: codesEntered ? "done" : authSatisfied ? "current" : "todo"
            });
        }
        steps.push({
            title: "Answer & submit",
            description: "Answer questions and submit when done.",
            status: submission ? "done" : bank ? "current" : "todo"
        });
        return steps;
    })();
        const layout = (_jsxs(PageShell, { className: "py-0 pb-24 lg:pb-10", children: [_jsxs(Card, { className: "mt-4 space-y-3", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-lg font-semibold text-text", children: [examTitle, (config === null || config === void 0 ? void 0 : config.subject) ? ` — ${config.subject}` : ""] }), _jsx("p", { className: "text-sm text-textMuted", children: "Answer questions and submit when done." })] }), timeLimitMinutes ? (_jsxs("div", { className: "flex flex-wrap items-center gap-2 text-sm", children: [_jsx(Badge, { tone: timeExpired ? "warn" : "info", children: timeRemainingMs === null ? "Time limit" : formatTimeRemaining(timeRemainingMs) }), _jsxs("span", { className: "text-xs text-textMuted", children: ["Limit: ", timeLimitMinutes, " minutes"] })] })) : null, _jsx(StepIndicator, { steps: startSteps }), _jsx("div", { role: "status", "aria-live": "polite", className: "text-xs text-textMuted min-h-[1.25rem]", children: draftNotice ?? "" })] }), submission ? (_jsxs(Card, { className: "mt-4 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "Score" }), _jsxs(Badge, { tone: "success", children: [submission.score.correct, "/", submission.score.total] })] }), _jsx("div", { className: "text-sm text-textMuted", children: "Submission recorded." }), signedIn ? (_jsx(Link, { to: "/history", className: "inline-flex", children: _jsx(Button, { variant: "secondary", size: "sm", children: "View in My History" }) })) : null] })) : null, status ? _jsx(Alert, { tone: status.tone, className: "mt-3", children: status.text }) : null, _jsxs("div", { className: "grid gap-4 lg:grid-cols-[2fr,1fr] mt-4", children: [_jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { className: "sticky top-24 z-10 space-y-3 bg-card/95 backdrop-blur", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [!bank ? (_jsx(Button, { variant: "primary", size: "sm", onClick: handleBank, disabled: loadDisabled, children: "Load questions" })) : (_jsx(Badge, { tone: "info", children: "Questions loaded" })), _jsx(Button, { variant: "secondary", size: "sm", onClick: handleSaveForLater, disabled: !bank || !versionId, children: "Save answers" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: openClearAnswersConfirm, disabled: !bank || !!submission, children: "Clear all answers" })] }), loadDisabled && !bank ? (_jsx("div", { className: "text-xs text-textMuted", children: authMode === "required" && !signedIn
                                    ? "Sign in to load questions."
                                    : "Enter the view code to load questions." })) : null] }), bank ? (bank.questions.map((q, idx) => {
                            const pq = submission?.perQuestion?.find((p) => p.uid === q.uid);
                            const submissionStatus = pq?.correct === true ? "correct" : submission ? "incorrect" : undefined;
                            return (_jsx("div", { id: `q-${idx + 1}`, children: q.type === "mcq-single" ? (_jsx(McqQuestion, { index: idx, question: q, answer: typeof answers[q.uid] === "string" ? answers[q.uid] : "", onChange: (uid, val) => setAnswers((prev) => ({ ...prev, [uid]: val })), showSolution: showSolutions && config?.policy.solutionsMode !== "never", submissionStatus: submissionStatus })) : q.type === "fill-blank" ? (_jsx(FillBlankQuestion, { index: idx, question: q, answer: answers[q.uid], onChange: (uid, val) => setAnswers((prev) => ({ ...prev, [uid]: val })), showSolution: showSolutions && config?.policy.solutionsMode !== "never", submissionStatus: submissionStatus })) : null }, q.uid));
                        })) : (_jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-text", children: "Questions not loaded" }), _jsx("p", { className: "text-sm text-textMuted", children: "Use the controls at the top to get started." })] }), _jsxs("ol", { className: "text-sm text-textMuted list-decimal pl-5 space-y-1", children: [_jsxs("li", { children: ["If required, sign in and enter your access code."] }), _jsxs("li", { children: ["Click ", _jsx("strong", { children: "Load questions" }), "."] })] })] })) }), _jsxs("div", { className: "space-y-4", children: [_jsxs(Card, { className: "sticky top-24 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-sm font-semibold", children: "Summary" }), _jsxs(Badge, { tone: "info", children: [Math.round(completionPct), "%"] })] }), _jsx(ProgressBar, { value: completionPct }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { className: "p-2 rounded-lg bg-muted", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Answered" }), _jsx("div", { className: "font-semibold", children: answeredCount })] }), _jsxs("div", { className: "p-2 rounded-lg bg-muted", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Remaining" }), _jsx("div", { className: "font-semibold", children: remainingCount })] })] }), timeLimitMinutes ? (_jsxs("div", { className: "rounded-lg border border-border p-2 text-xs text-textMuted", children: [_jsx("div", { className: "text-[11px] uppercase tracking-wide", children: "Time remaining" }), _jsx("div", { className: clsx("mt-1 text-sm font-semibold", timeExpired ? "text-warn" : "text-text"), children: timeRemainingMs === null ? "—" : formatTimeRemaining(timeRemainingMs) })] })) : null, submission ? (_jsxs("div", { className: "p-3 rounded-lg bg-success/10 text-success text-sm", children: ["Score: ", submission.score.correct, "/", submission.score.total] })) : null, _jsx(Button, { variant: "secondary", size: "sm", onClick: reviewUnanswered, disabled: !bank || remainingCount === 0, className: "w-full", children: "Review unanswered" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: openClearDraftConfirm, disabled: !versionId || !hasDraft, children: "Clear saved draft" }), canShare ? (_jsx(Button, { variant: "secondary", size: "sm", onClick: handleShare, children: "Share exam link" })) : null, _jsx("div", { className: "text-xs text-textMuted", children: "Jump to question" }), _jsx("div", { className: "flex flex-wrap gap-2", children: Array.from({ length: totalQuestions }).map((_, i) => {
                                            const idx = i + 1;
                                            const answered = !!answers[bank?.questions[i]?.uid ?? ""];
                                            return (_jsx("button", { className: clsx("w-9 h-9 rounded-full border text-sm font-semibold", answered ? "bg-info/10 border-info text-info" : "bg-muted border-border text-textMuted"), onClick: () => document.getElementById(`q-${idx}`)?.scrollIntoView({ behavior: "smooth" }), children: idx }, idx));
                                        }) })] }), authMode === "required" ? (_jsxs(Accordion, { title: "Authentication", defaultOpen: true, tone: "muted", children: [_jsxs("div", { className: "flex gap-2 flex-wrap", children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: handleGithub, children: "GitHub Login" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: handleGoogle, children: "Google Login" })] }), _jsx("div", { className: "text-xs text-textMuted", children: "Sign in to access this exam." }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Current session: ", session ? session.provider : "none"] })] })) : null, codesRequired ? (_jsxs(Accordion, { title: "Access codes", defaultOpen: true, tone: "warn", children: [_jsx("div", { className: "text-xs text-textMuted", children: "View code unlocks questions. Submit code is only required when you submit your final answers." }), requireViewCode ? (_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium", children: "View code" }), _jsx("input", { className: "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info", value: viewCode, onChange: (e) => setViewCode(e.target.value), placeholder: "Enter view code" })] })) : null, requireSubmitCode ? (_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium", children: "Submit code" }), _jsx("input", { className: "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info", value: submitCode, onChange: (e) => setSubmitCode(e.target.value), placeholder: "Enter submit code" })] })) : null] })) : null, _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("div", { className: "font-semibold text-sm", children: "Submit" }), _jsxs(Badge, { tone: submitDisabled ? "warn" : "info", children: [answeredCount, "/", totalQuestions, " answered"] })] }), _jsx(Button, { variant: "secondary", onClick: handleSaveForLater, disabled: !bank || !versionId, className: "w-full", children: "Save & submit later" }), _jsx(Button, { onClick: openSubmitConfirm, disabled: submitDisabled, className: "w-full", children: "Submit answers" })] })] })] })] }));
    if (loading) {
        return _jsx("div", { className: "p-6 text-center text-sm text-textMuted", children: "Loading exam..." });
    }
    if (!config) {
        return _jsx("div", { className: "p-6 text-center text-sm text-textMuted", children: "Exam not found." });
    }
    return (_jsxs(_Fragment, { children: [_jsx(StickyHeader, { examId: config.examId, subject: config.subject, title: config.title ?? null, progressPct: completionPct, answered: answeredCount, total: totalQuestions || config.composition.reduce((acc, i) => acc + i.n, 0), status: status?.text }), layout, confirmOpen ? (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: () => setConfirmOpen(false) }), _jsxs(Card, { className: "relative w-full max-w-md space-y-3", children: [_jsx("div", { className: "text-base font-semibold text-text", children: "Submit answers?" }), _jsxs("div", { className: "text-sm text-textMuted", children: ["You answered ", answeredCount, "/", totalQuestions || "?", ". Submit now?"] }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => setConfirmOpen(false), children: "Cancel" }), _jsx(Button, { onClick: () => {
                                            setConfirmOpen(false);
                                            void handleSubmit();
                                        }, children: "Submit" })] })] })] })) : null, clearConfirmOpen ? (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: () => setClearConfirmOpen(false) }), _jsxs(Card, { className: "relative w-full max-w-md space-y-3", children: [_jsx("div", { className: "text-base font-semibold text-text", children: "Clear saved draft?" }), _jsx("div", { className: "text-sm text-textMuted", children: "This will remove your saved answers for this exam version." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => setClearConfirmOpen(false), children: "Cancel" }), _jsx(Button, { variant: "danger", onClick: () => {
                                            setClearConfirmOpen(false);
                                            handleClearDraft();
                                        }, children: "Clear draft" })] })] })] })) : null, clearAnswersOpen ? (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: () => setClearAnswersOpen(false) }), _jsxs(Card, { className: "relative w-full max-w-md space-y-3", children: [_jsx("div", { className: "text-base font-semibold text-text", children: "Clear all answers?" }), _jsx("div", { className: "text-sm text-textMuted", children: "This removes your current answers for this exam version." }), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => setClearAnswersOpen(false), children: "Cancel" }), _jsx(Button, { variant: "danger", onClick: () => {
                                            setClearAnswersOpen(false);
                                            handleClearAllAnswers();
                                        }, children: "Clear answers" })] })] })] })) : null, _jsxs(FloatingActionBar, { show: true, children: [_jsxs(FloatingActionsRow, { className: "justify-between items-center text-xs text-textMuted", children: [_jsxs("div", { children: [answeredCount, "/", totalQuestions || "?", " answered"] }), _jsxs("div", { children: [Math.round(completionPct), "% complete"] })] }), _jsxs(FloatingActionsRow, { children: [requireViewCode ? (_jsx("input", { className: "flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info", value: viewCode, onChange: (e) => setViewCode(e.target.value), placeholder: "View code" })) : null, requireSubmitCode ? (_jsx("input", { className: "flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info", value: submitCode, onChange: (e) => setSubmitCode(e.target.value), placeholder: "Submit code" })) : null] }), _jsxs(FloatingActionsRow, { children: [_jsx(Button, { variant: "secondary", className: "flex-1", onClick: handleSaveForLater, disabled: !bank || !versionId, children: "Save & submit later" }), _jsx(Button, { variant: "secondary", className: "flex-1", onClick: reviewUnanswered, disabled: !bank || remainingCount === 0, children: "Review unanswered" }), _jsx(FloatingPrimaryButton, { disabled: submitDisabled, onClick: openSubmitConfirm, children: "Submit" })] })] })] }));
}
