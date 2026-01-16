import { HashRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Session } from "./api";
import { getDefaultTimeFormat, getDefaultTimezone, listPublicExams, type PublicExamSummary } from "./api";
import { ExamPage } from "./pages/ExamPage";
import { Card } from "./components/ui/Card";
import { AdminHome } from "./pages/admin/AdminHome";
import { AdminExamsPage } from "./pages/admin/AdminExamsPage";
import { CreateExamPage } from "./pages/admin/CreateExamPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { SourcesManagerPage } from "./pages/admin/SourcesManagerPage";
import { ExtraToolsPage } from "./pages/admin/ExtraToolsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ShortLinkRedirect } from "./pages/ShortLinkRedirect";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { TopBar } from "./components/layout/TopBar";
import { PageShell } from "./components/layout/PageShell";
import { StepIndicator } from "./components/ui/StepIndicator";
import { formatDateTime, initDefaultTimeFormat, initDefaultTimezone, onTimeFormatChange, onTimezoneChange } from "./utils/time";
import { ExamListItem } from "./components/ExamListItem";

const showAdminLink = new URLSearchParams(window.location.search).get("admin") === "1";

function Home() {
  const [examId, setExamId] = useState("");
  const [openExams, setOpenExams] = useState<PublicExamSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const navigate = useNavigate();

  const parseExamLink = (raw: string): { subject: string; examId: string } | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      const u = new URL(trimmed);
      const m = (u.hash ?? "").match(/#\/exam\/([^/?]+)\/([^/?]+)/);
      if (m) {
        return { subject: decodeURIComponent(m[1]), examId: decodeURIComponent(m[2]) };
      }
      const legacy = (u.hash ?? "").match(/#\/exam\/([^/?]+)/);
      if (legacy) {
        return { subject: "discrete-math", examId: decodeURIComponent(legacy[1]) };
      }
    } catch {
      // not a full URL
    }

    const m = trimmed.match(/#\/exam\/([^/?]+)\/([^/?]+)/) ?? trimmed.match(/\/exam\/([^/?]+)\/([^/?]+)/);
    if (m) {
      return { subject: decodeURIComponent(m[1]), examId: decodeURIComponent(m[2]) };
    }
    const legacy = trimmed.match(/#\/exam\/([^/?]+)/) ?? trimmed.match(/\/exam\/([^/?]+)/);
    if (legacy) {
      return { subject: "discrete-math", examId: decodeURIComponent(legacy[1]) };
    }
    return { subject: "discrete-math", examId: trimmed };
  };

  const go = () => {
    const parsed = parseExamLink(examId);
    if (!parsed) return;
    navigate(`/exam/${encodeURIComponent(parsed.subject)}/${encodeURIComponent(parsed.examId)}`);
  };


  const loadExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPublicExams();
      setOpenExams(res.items ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load open exams.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExams();
  }, []);

  return (
    <PageShell maxWidth="4xl" className="space-y-8 w-full">
      <div>
        <h1 className="text-3xl font-bold text-text mb-2">Welcome to Quiz Platform</h1>
        <p className="text-textMuted max-w-2xl">
          Access your assigned exams or practice with public available tests.
        </p>
      </div>

      {notice && (
        <div className={`p-4 rounded-lg flex items-center justify-between ${notice.tone === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="ml-4 text-sm font-medium hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-text">Start an exam</h2>
          <p className="text-sm text-textMuted">
            Paste the link your instructor gave you, or enter the exam ID. If you get asked for a <strong>view code</strong> or
            <strong> submit code</strong>, you’ll enter it after opening the exam.
          </p>
          <p className="text-xs text-textMuted">Need help? Use <strong>Help</strong> in the top bar.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium text-text" htmlFor="exam-id">
              Exam link or ID
            </label>
            <Input
              id="exam-id"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              placeholder="Paste link (/#/exam/discrete-math/abc123) or enter ID (abc123)"
              onKeyDown={(e) => (e.key === "Enter" ? go() : null)}
            />
            <div className="text-xs text-textMuted">We’ll extract the exam ID automatically if you paste a full link.</div>
          </div>
          <Button type="button" onClick={go} disabled={!parseExamLink(examId)}>
            Open exam
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-muted p-4">
          <div className="text-sm font-semibold text-text">What happens next</div>
          <StepIndicator
            className="mt-3"
            steps={[
              {
                title: "Open the exam",
                description: "You’ll land on a start panel for authentication and access.",
                status: "current"
              },
              {
                title: "Sign in (if required)",
                description: "Some exams require sign-in before you can load questions.",
                status: "todo"
              },
              {
                title: "Enter access codes (if required)",
                description: "Use the view/submit code your instructor provided.",
                status: "todo"
              },
              {
                title: "Load questions and answer",
                description: "The page will guide you and auto-save drafts as you go.",
                status: "todo"
              },
              {
                title: "Submit",
                description: "After submitting, you may see solutions depending on the exam policy.",
                status: "todo"
              }
            ]}
          />
        </div>
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Open exams</h2>
          <p className="text-sm text-textMuted">Public exams that don’t require sign-in or access codes.</p>
        </div>
        {error ? <div className="text-sm text-error">{error}</div> : null}
        {loading ? (
          <div className="text-sm text-textMuted">Loading open exams...</div>
        ) : openExams.length ? (
          <div className="space-y-2 text-sm">
            {openExams.map((exam) => (
              <ExamListItem
                key={exam.examId}
                exam={exam}
                actions={[
                  {
                    label: "Open",
                    onClick: () =>
                      navigate(
                        `/exam/${encodeURIComponent(exam.subject)}/${encodeURIComponent(exam.examId)}`
                      )
                  },
                  {
                    label: "Copy link",
                    variant: "secondary",
                    onClick: async () => {
                      const url = `${window.location.origin}/#/exam/${encodeURIComponent(exam.subject)}/${encodeURIComponent(exam.examId)}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        setNotice({ tone: "success", text: "Link copied to clipboard" });
                        setTimeout(() => setNotice(null), 3000);
                      } catch {
                        setNotice({ tone: "error", text: "Failed to copy link" });
                      }
                    }
                  },
                  ...(exam.shortLinkCode ? [{
                    label: "Copy short link",
                    variant: "secondary" as const,
                    onClick: async () => {
                      const url = `${window.location.origin}/#/s/${exam.shortLinkCode}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        setNotice({ tone: "success", text: "Short link copied to clipboard" });
                        setTimeout(() => setNotice(null), 3000);
                      } catch {
                        setNotice({ tone: "error", text: "Failed to copy short link" });
                      }
                    }
                  }] : [])
                ]}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-textMuted">No open exams right now.</div>
        )}
      </Card>

      {
        showAdminLink ? (
          <div className="text-xs text-textMuted">
            <Link to="/admin" className="hover:underline">
              Admin
            </Link>
          </div>
        ) : null
      }
    </PageShell >
  );
}

type Props = {
  session: Session | null;
  setSession: (session: Session | null) => void;
};

export function AppRouter({ session, setSession }: Props) {
  const [, setTimezoneTick] = useState(0);

  useEffect(() => {
    void initDefaultTimezone(getDefaultTimezone);
    void initDefaultTimeFormat(getDefaultTimeFormat);
  }, []);
  useEffect(() => onTimezoneChange(() => setTimezoneTick((v) => v + 1)), []);
  useEffect(() => onTimeFormatChange(() => setTimezoneTick((v) => v + 1)), []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-bg">
        <TopBar session={session} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/exam/:subject/:examId" element={<ExamPage session={session} setSession={setSession} />} />
          <Route path="/exam/:examId" element={<ExamPage session={session} setSession={setSession} />} />
          <Route path="/s/:code" element={<ShortLinkRedirect />} />
          <Route path="/history" element={<HistoryPage session={session} setSession={setSession} />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminHome />} />
          <Route path="/admin/exams" element={<AdminExamsPage />} />
          <Route path="/admin/exams/new" element={<CreateExamPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/sources" element={<SourcesManagerPage />} />
          <Route path="/admin/tools" element={<ExtraToolsPage />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
