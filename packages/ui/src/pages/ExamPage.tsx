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

  const requireViewCode = config?.policy.requireViewCode;
  const requireSubmitCode = config?.policy.requireSubmitCode;

  const signedIn = session ? session.provider === "github" || session.provider === "google" : false;
  const authMode = config?.policy.authMode ?? "none";
  const authSatisfied = authMode !== "required" || signedIn;
  const codesRequired = !!requireViewCode || !!requireSubmitCode;
  const codesEntered = (!requireViewCode || !!viewCode) && (!requireSubmitCode || !!submitCode);

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

  const formatTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Time expired";
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
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
    if (!confirmOpen && !clearConfirmOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmOpen(false);
        setClearConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, clearConfirmOpen]);

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

  const handleAnonymous = async () => {
    await loginAnonymous();
    const sess = await getSession();
    if (sess) setSession(sess);
  };

  const handleClearDraft = () => {
    if (!versionId) return;
    clearDraft(examId, versionId);
    setAnswers({});
    setRestored(false);
    setHasDraft(false);
    setDraftNotice("Draft cleared");
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

  const openClearDraftConfirm = () => {
    if (!versionId || !hasDraft) return;
    setClearConfirmOpen(true);
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
          <h1 className="text-lg font-semibold text-text">Exam {config?.examId ?? examId}{config?.subject ? ` — ${config.subject}` : ""}</h1>
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
                <p className="text-sm text-textMuted">Use the panels on the right to get started.</p>
              </div>
              <ol className="text-sm text-textMuted list-decimal pl-5 space-y-1">
                <li>If needed, open the <strong>Authentication</strong> Accordion and sign in.</li>
                <li>If required, enter your <strong>View code</strong> in the <strong>Access codes</strong> Accordion.</li>
                <li>Click <strong>Load questions</strong>.</li>
              </ol>
            </Card>
          )}
        </div>

        <div className="space-y-4">
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

          <Accordion title="Authentication" defaultOpen tone="muted">
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" size="sm" onClick={handleGithub}>
                GitHub Login
              </Button>
              <Button variant="secondary" size="sm" onClick={handleGoogle}>
                Google Login
              </Button>
              {config?.policy.authMode === "optional" ? (
                <Button variant="ghost" size="sm" onClick={handleAnonymous}>
                  Continue anonymously
                </Button>
              ) : null}
            </div>
            <div className="text-xs text-textMuted">
              Signing in lets you view submission history and helps keep a consistent per-student version on repeat visits.
            </div>
            <div className="text-xs text-textMuted">Current session: {session ? session.provider : "none"}</div>
          </Accordion>

          <Accordion title="Access codes" defaultOpen tone={requireViewCode || requireSubmitCode ? "warn" : "muted"}>
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
            ) : (
              <div className="text-sm text-textMuted">No view code required.</div>
            )}
            <Button variant="primary" size="sm" onClick={handleBank}>
              Load questions
            </Button>

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
            ) : (
              <div className="text-sm text-textMuted">No submit code required.</div>
            )}
          </Accordion>

          <Card className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-sm">Submit</div>
              <Badge tone={submitDisabled ? "warn" : "info"}>
                {answeredCount}/{totalQuestions} answered
              </Badge>
            </div>
            <Button variant="secondary" onClick={handleSaveForLater} disabled={!bank || !versionId} className="w-full">
              Save &amp; submit later
            </Button>
            <Button onClick={openSubmitConfirm} disabled={submitDisabled} className="w-full">
              Submit answers
            </Button>
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
        progressPct={completionPct}
        answered={answeredCount}
        total={totalQuestions || config.composition.reduce((acc, i) => acc + i.n, 0)}
        status={status?.text}
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

      <FloatingActionBar show>
        <FloatingActionsRow className="justify-between items-center text-xs text-textMuted">
          <div>
            {answeredCount}/{totalQuestions || "?"} answered
          </div>
          <div>{Math.round(completionPct)}% complete</div>
        </FloatingActionsRow>
        <FloatingActionsRow>
          {requireViewCode ? (
            <input
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info"
              value={viewCode}
              onChange={(e) => setViewCode(e.target.value)}
              placeholder="View code"
            />
          ) : null}
          {requireSubmitCode ? (
            <input
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info"
              value={submitCode}
              onChange={(e) => setSubmitCode(e.target.value)}
              placeholder="Submit code"
            />
          ) : null}
        </FloatingActionsRow>
        <FloatingActionsRow>
          <Button variant="secondary" className="flex-1" onClick={handleSaveForLater} disabled={!bank || !versionId}>
            Save &amp; submit later
          </Button>
          <Button variant="secondary" className="flex-1" onClick={reviewUnanswered} disabled={!bank || remainingCount === 0}>
            Review unanswered
          </Button>
          <FloatingPrimaryButton disabled={submitDisabled} onClick={openSubmitConfirm}>
            Submit
          </FloatingPrimaryButton>
        </FloatingActionsRow>
      </FloatingActionBar>
    </>
  );
}
