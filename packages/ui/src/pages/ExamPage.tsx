import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ExamBankResponse,
  ExamConfigResponse,
  Session,
  SessionUser,
  getExamBank,
  getExamConfig,
  getSession,
  githubLoginUrl,
  googleLoginUrl,
  loginAnonymous,
  submitExam
} from "../api";
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
import { StepIndicator, type Step } from "../components/ui/StepIndicator";
import { PageShell } from "../components/layout/PageShell";
import { LatexContent } from "../components/LatexContent";

type StatusTone = "info" | "warn" | "error" | "success";

type StatusMessage = { tone: StatusTone; text: string } | null;

export function ExamPage({ session, setSession }: { session: Session | null; setSession: (s: Session | null) => void }) {
  const { examId = "" } = useParams<{ examId: string }>();
  const [config, setConfig] = useState<ExamConfigResponse | null>(null);
  const [bank, setBank] = useState<ExamBankResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [versionId, setVersionId] = useState<string | null>(null);
  const [submitCode, setSubmitCode] = useState("");
  const [viewCode, setViewCode] = useState("");
  const [submission, setSubmission] = useState<any>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [loading, setLoading] = useState(true);
  const [restored, setRestored] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearAnswersOpen, setClearAnswersOpen] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [timeRemainingMs, setTimeRemainingMs] = useState<number | null>(null);
  const [timeStartIso, setTimeStartIso] = useState<string | null>(null);
  const draftNoticeTimerRef = useRef<number | null>(null);
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
        const needsPerStudentSession =
          cfg.policy.versioningMode === "per_student" && cfg.policy.authMode !== "required";
        if (needsPerStudentSession) {
          try {
            const sess = await getSession();
            if (sess) {
              setSession(sess);
            } else {
              await loginAnonymous();
              const anonSess = await getSession();
              if (anonSess) setSession(anonSess);
            }
          } catch {
            // silent, still allow fetch to continue
          }
        }
      } catch (err: any) {
        setStatus({ tone: "error", text: err.message });
      } finally {
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
  const examTitle = config?.title ? config.title : `Exam ${config?.examId ?? examId}`;
  const examLink = config
    ? (() => {
      const rawBase = import.meta.env.VITE_BASE_URL ?? "/";
      const trimmed = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase;
      const base = trimmed === "/" ? "" : trimmed;
      return `${window.location.origin}${base}/#/exam/${encodeURIComponent(config.subject)}/${encodeURIComponent(
        config.examId
      )}`;
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
    if (!examId) return;
    const key = `exam:viewCode:${examId}`;
    if (viewCode) {
      sessionStorage.setItem(key, viewCode);
    } else {
      sessionStorage.removeItem(key);
    }
  }, [examId, viewCode]);

  useEffect(() => {
    if (!examId) return;
    const key = `exam:submitCode:${examId}`;
    if (submitCode) {
      sessionStorage.setItem(key, submitCode);
    } else {
      sessionStorage.removeItem(key);
    }
  }, [examId, submitCode]);

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Time expired";
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
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
    if (!timeStartIso || !timeLimitMinutes) return;
    const startMs = Date.parse(timeStartIso);
    if (Number.isNaN(startMs)) return;
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
    if (!versionId) return;
    const draft = loadDraft(examId, versionId);
    if (draft?.answers) {
      setAnswers(draft.answers);
      setRestored(true);
      setHasDraft(true);
      setDraftNotice("Draft restored");
    } else {
      setHasDraft(false);
    }
  }, [examId, versionId]);

  useEffect(() => {
    if (!versionId || !bank) return;
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
    if (!bank) return;

    let timer: number | null = null;
    const resolveNumbers = () => {
      // Find all figures in order
      const figures = Array.from(document.querySelectorAll('[data-latex-type="figure"]'));
      const labelToNum = new Map<string, number>();

      figures.forEach((fig, i) => {
        const num = i + 1;

        // Primary label
        const primaryLabel = fig.getAttribute("data-label");
        if (primaryLabel) labelToNum.set(primaryLabel, num);

        // Map auxiliary anchors to the same number
        // These are siblings of the figure
        let prev = fig.previousElementSibling;
        while (prev && prev.getAttribute("data-latex-type") === "anchor") {
          const aid = prev.getAttribute("data-label");
          if (aid) labelToNum.set(aid, num);
          prev = prev.previousElementSibling;
        }
      });

      // Update all placeholders
      const spans = Array.from(document.querySelectorAll(".latex-fig-num"));
      spans.forEach((span) => {
        const label = span.getAttribute("data-label");
        if (label) {
          const n = labelToNum.get(label);
          if (n !== undefined) {
            span.textContent = n.toString();
          } else {
            span.textContent = "?";
          }
        }
      });
    };

    const debouncedResolve = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(resolveNumbers, 100);
    };

    resolveNumbers();

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (const m of mutations) {
        if (m.type === "childList" || m.type === "characterData") {
          // Ignore our own updates to textContent of spans
          const target = m.target as HTMLElement;
          if (target.classList?.contains("latex-fig-num") || target.parentElement?.classList?.contains("latex-fig-num")) {
            continue;
          }
          shouldUpdate = true;
          break;
        }
      }
      if (shouldUpdate) debouncedResolve();
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [bank]);

  useEffect(() => {
    if (!confirmOpen && !clearConfirmOpen && !clearAnswersOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
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
    if (!config || bank) return;
    const autoLoad = sessionStorage.getItem(`exam:autoLoad:${examId}`) === "1";
    if (!autoLoad) return;
    if (authMode === "required" && !signedIn) return;
    if (requireViewCode && !viewCode) return;
    void handleBank();
  }, [authMode, bank, config, examId, requireViewCode, signedIn, viewCode]);

  const handleBank = async () => {
    if (!config) return;
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
    } catch (err: any) {
      const msg = err?.message ?? "Failed to load questions";
      const tone: StatusTone = msg.includes("Unauthorized") ? "error" : msg.includes("Forbidden") ? "warn" : "error";
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
      if (versionId) clearDraft(examId, versionId);
      await handleBank(); // refresh for solutions if always
    } catch (err: any) {
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
    if (!versionId) return;
    clearDraft(examId, versionId);
    setAnswers({});
    setRestored(false);
    setHasDraft(false);
    setDraftNotice("Draft cleared");
  };

  const handleClearAllAnswers = () => {
    if (!bank || submission) return;
    if (versionId) clearDraft(examId, versionId);
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
    if (!canShare || !examLink) return;
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
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setStatus({ tone: "error", text: err?.message ?? "Share failed." });
    }
  };

  const openClearDraftConfirm = () => {
    if (!versionId || !hasDraft) return;
    setClearConfirmOpen(true);
  };

  const openClearAnswersConfirm = () => {
    if (!bank || submission) return;
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

  const startSteps: Step[] = (() => {
    const steps: Step[] = [];

    const authStep: Step = {
      title: "Sign in",
      description:
        authMode === "required"
          ? "Required for this exam."
          : authMode === "optional"
            ? "Optional — helps save your history and keep a consistent per-student version."
            : "Skipped for this exam.",
      status:
        authMode === "required" ? (signedIn ? "done" : "current") : authMode === "optional" ? (signedIn ? "done" : "optional") : "done"
    };

    steps.push(authStep);

    if (codesRequired) {
      steps.push({
        title: "Enter access code",
        description:
          requireViewCode && requireSubmitCode
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

  const layout = (
    <PageShell className="py-0 pb-24 lg:pb-10">
      <Card className="mt-4 space-y-3">
        <div>
          <h1 className="text-lg font-semibold text-text">{examTitle}{config?.subject ? ` — ${config.subject}` : ""}</h1>
          <p className="text-sm text-textMuted">Answer questions and submit when done.</p>
        </div>
        {timeLimitMinutes ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={timeExpired ? "warn" : "info"}>
              {timeRemainingMs === null ? "Time limit" : formatTimeRemaining(timeRemainingMs)}
            </Badge>
            <span className="text-xs text-textMuted">Limit: {timeLimitMinutes} minutes</span>
          </div>
        ) : null}
        <StepIndicator steps={startSteps} />
        <div role="status" aria-live="polite" className="text-xs text-textMuted min-h-[1.25rem]">
          {draftNotice ?? ""}
        </div>
      </Card>

      {submission ? (
        <Card className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-text">Score</div>
            <Badge tone="success">
              {submission.score.correct}/{submission.score.total}
            </Badge>
          </div>
          <div className="text-sm text-textMuted">Submission recorded.</div>
          {signedIn ? (
            <Link to="/history" className="inline-flex">
              <Button variant="secondary" size="sm">View in My History</Button>
            </Link>
          ) : null}
        </Card>
      ) : null}

      {status ? <Alert tone={status.tone} className="mt-3">{status.text}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[2fr,1fr] mt-4">
        <div className="space-y-4">
          {config?.notice ? (
            <Card className="border-info/30 bg-info/5 dark:bg-info/10">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 text-info">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-info">Notice</h3>
                  <div className="mt-1 text-sm text-neutral-800 dark:text-neutral-200">
                    <LatexContent content={config.notice} />
                  </div>
                </div>
              </div>
            </Card>
          ) : null}
          {bank ? (
            bank.questions.map((q, idx) => {
              const pq = submission?.perQuestion?.find((p: any) => p.uid === q.uid);
              const submissionStatus =
                pq?.correct === true ? "correct" : submission ? "incorrect" : undefined;

              return (
                <div id={`q-${idx + 1}`} key={q.uid}>
                  {q.type === "mcq-single" ? (
                    <McqQuestion
                      index={idx}
                      question={q}
                      answer={typeof answers[q.uid] === "string" ? (answers[q.uid] as string) : ""}
                      onChange={(uid, val) => setAnswers((prev) => ({ ...prev, [uid]: val }))}
                      showSolution={showSolutions && config?.policy.solutionsMode !== "never"}
                      submissionStatus={submissionStatus}
                    />
                  ) : q.type === "fill-blank" ? (
                    <FillBlankQuestion
                      index={idx}
                      question={q}
                      answer={answers[q.uid]}
                      onChange={(uid, val) => setAnswers((prev) => ({ ...prev, [uid]: val }))}
                      showSolution={showSolutions && config?.policy.solutionsMode !== "never"}
                      submissionStatus={submissionStatus}
                    />
                  ) : null}
                </div>
              );
            })
          ) : (
            <Card className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-text">Questions not loaded</p>
                <p className="text-sm text-textMuted">Use the controls at the top to get started.</p>
              </div>
              <ol className="text-sm text-textMuted list-decimal pl-5 space-y-1">
                <li>If required, sign in and enter your access code.</li>
                <li>Click <strong>Load questions</strong>.</li>
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {authMode === "required" ? (
            <Accordion title="Authentication" defaultOpen tone="muted">
              <div className="flex gap-2 flex-wrap">
                <Button variant="secondary" size="sm" onClick={handleGithub}>
                  GitHub Login
                </Button>
                <Button variant="secondary" size="sm" onClick={handleGoogle}>
                  Google Login
                </Button>
              </div>
              <div className="text-xs text-textMuted">
                Sign in to access this exam.
              </div>
              <div className="text-xs text-textMuted">Current session: {session ? session.provider : "none"}</div>
            </Accordion>
          ) : null}

          {codesRequired ? (
            <Accordion title="Access codes" defaultOpen tone="warn">
              <div className="text-xs text-textMuted">
                View code unlocks questions. Submit code is only required when you submit your final answers.
              </div>
              {requireViewCode ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">View code</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info"
                    value={viewCode}
                    onChange={(e) => setViewCode(e.target.value)}
                    placeholder="Enter view code"
                  />
                </div>
              ) : null}

              {requireSubmitCode ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Submit code</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info"
                    value={submitCode}
                    onChange={(e) => setSubmitCode(e.target.value)}
                    placeholder="Enter submit code"
                  />
                </div>
              ) : null}
            </Accordion>
          ) : null}


          <Card className="sticky top-24 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Summary</div>
              <Badge tone="info">{Math.round(completionPct)}%</Badge>
            </div>
            <ProgressBar value={completionPct} />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 rounded-lg bg-muted">
                <div className="text-xs text-textMuted">Answered</div>
                <div className="font-semibold">{answeredCount}</div>
              </div>
              <div className="p-2 rounded-lg bg-muted">
                <div className="text-xs text-textMuted">Remaining</div>
                <div className="font-semibold">{remainingCount}</div>
              </div>
            </div>
            {timeLimitMinutes ? (
              <div className="rounded-lg border border-border p-2 text-xs text-textMuted">
                <div className="text-[11px] uppercase tracking-wide">Time remaining</div>
                <div className={clsx("mt-1 text-sm font-semibold", timeExpired ? "text-warn" : "text-text")}>
                  {timeRemainingMs === null ? "—" : formatTimeRemaining(timeRemainingMs)}
                </div>
              </div>
            ) : null}
            {submission ? (
              <div className="p-3 rounded-lg bg-success/10 text-success text-sm">
                Score: {submission.score.correct}/{submission.score.total}
              </div>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={reviewUnanswered}
              disabled={!bank || remainingCount === 0}
              className="w-full"
            >
              Review unanswered
            </Button>
            <Button variant="ghost" size="sm" onClick={openClearDraftConfirm} disabled={!versionId || !hasDraft}>
              Clear saved draft
            </Button>
            {canShare ? (
              <Button variant="secondary" size="sm" onClick={handleShare}>
                Share exam link
              </Button>
            ) : null}
            <div className="text-xs text-textMuted">Jump to question</div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: totalQuestions }).map((_, i) => {
                const idx = i + 1;
                const answered = !!answers[bank?.questions[i]?.uid ?? ""];
                return (
                  <button
                    key={idx}
                    className={clsx(
                      "w-9 h-9 rounded-full border text-sm font-semibold",
                      answered ? "bg-info/10 border-info text-info" : "bg-muted border-border text-textMuted"
                    )}
                    onClick={() => document.getElementById(`q-${idx}`)?.scrollIntoView({ behavior: "smooth" })}
                  >
                    {idx}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );

  if (loading) {
    return <div className="p-6 text-center text-sm text-textMuted">Loading exam...</div>;
  }

  if (!config) {
    return <div className="p-6 text-center text-sm text-textMuted">Exam not found.</div>;
  }

  return (
    <>
      <StickyHeader
        examId={config.examId}
        subject={config.subject}
        title={config.title ?? null}
        progressPct={completionPct}
        answered={answeredCount}
        total={totalQuestions || config.composition.reduce((acc, i) => acc + i.n, 0)}
        status={status?.text}
        bankLoaded={!!bank}
        onLoadQuestions={handleBank}
        onClearAnswers={openClearAnswersConfirm}
        onSave={handleSaveForLater}
        onSubmit={openSubmitConfirm}
        onScrollTop={scrollToTop}
        onScrollBottom={scrollToBottom}
        loadDisabled={loadDisabled}
        clearDisabled={!bank || !!submission}
        saveDisabled={!bank || !versionId}
        submitDisabled={submitDisabled}
      />
      {layout}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)} />
          <Card className="relative w-full max-w-md space-y-3">
            <div className="text-base font-semibold text-text">Submit answers?</div>
            <div className="text-sm text-textMuted">
              You answered {answeredCount}/{totalQuestions || "?"}. Submit now?
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setConfirmOpen(false);
                  void handleSubmit();
                }}
              >
                Submit
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {clearConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setClearConfirmOpen(false)} />
          <Card className="relative w-full max-w-md space-y-3">
            <div className="text-base font-semibold text-text">Clear saved draft?</div>
            <div className="text-sm text-textMuted">
              This will remove your saved answers for this exam version.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setClearConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setClearConfirmOpen(false);
                  handleClearDraft();
                }}
              >
                Clear draft
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {clearAnswersOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setClearAnswersOpen(false)} />
          <Card className="relative w-full max-w-md space-y-3">
            <div className="text-base font-semibold text-text">Clear all answers?</div>
            <div className="text-sm text-textMuted">
              This removes your current answers for this exam version.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setClearAnswersOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setClearAnswersOpen(false);
                  handleClearAllAnswers();
                }}
              >
                Clear answers
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

    </>
  );
}
