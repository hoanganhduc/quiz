import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getUserSubmissions,
  githubLoginUrl,
  Session,
  SessionUser,
  getSession,
  googleLoginUrl
} from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";

type StatusTone = "info" | "warn" | "error" | "success";
type StatusMessage = { tone: StatusTone; text: string } | null;

type SubmissionSummary = Awaited<ReturnType<typeof getUserSubmissions>>["submissions"][number];

type Props = { session: Session | null; setSession: (s: Session | null) => void };

export function HistoryPage({ session, setSession }: Props) {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

  const loggedIn =
    session && (session.provider === "github" || session.provider === "google");

  const loadPage = async (next?: string) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await getUserSubmissions(next);
      const nextSubs = Array.isArray((res as any).submissions) ? ((res as any).submissions as SubmissionSummary[]) : [];
      setSubmissions((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return next ? [...safePrev, ...nextSubs] : nextSubs;
      });
      setCursor((res as any).nextCursor);
    } catch (err: any) {
      setStatus({ tone: "error", text: err?.message ?? "Failed to load submissions" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loggedIn) {
      void loadPage();
    } else {
      setSubmissions([]);
      setCursor(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const handleGithub = () => {
    window.location.href = githubLoginUrl(window.location.href);
  };

  const handleGoogle = () => {
    window.location.href = googleLoginUrl(window.location.href);
  };

  const refreshSession = async () => {
    try {
      const sess = await getSession();
      setSession(sess);
    } catch {
      setSession(null);
    }
  };

  useEffect(() => {
    void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell maxWidth="4xl" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Submission History</h1>
          <p className="text-sm text-textMuted">Review past submissions and scores.</p>
        </div>
        {loggedIn ? (
          <Badge tone="success">{(session as SessionUser)?.username ?? session?.provider}</Badge>
        ) : (
          <Badge tone="warn">Sign in required</Badge>
        )}
      </div>

      {status ? <Alert tone={status.tone}>{status.text}</Alert> : null}

      {!loggedIn ? (
        <Card className="space-y-3">
          <p className="text-sm text-text">Sign in to view your submission history.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleGithub}>
              Sign in with GitHub
            </Button>
            <Button variant="secondary" onClick={handleGoogle}>
              Sign in with Google
            </Button>
          </div>
        </Card>
      ) : null}

      {loggedIn ? (
        <div className="space-y-3">
          {Array.isArray(submissions) && submissions.length === 0 && !loading ? (
            <Card>
              <p className="text-sm text-textMuted">No submissions yet.</p>
            </Card>
          ) : (
            (Array.isArray(submissions) ? submissions : []).map((s) => (
              <Card key={s.submissionId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-text">{new Date(s.submittedAt).toLocaleString()}</div>
                    <div className="text-xs text-textMuted">Exam: {s.examId}</div>
                  </div>
                  <Badge tone="info">
                    {s.score.correct}/{s.score.total}
                  </Badge>
                </div>
                {s.version?.versionId ? (
                  <div className="text-xs text-textMuted">Version: {s.version.versionId}</div>
                ) : null}
                <div>
                  <Link to={`/history/${s.submissionId}`} className="text-sm text-info hover:underline">
                    View details
                  </Link>
                </div>
              </Card>
            ))
          )}
          {cursor ? (
            <Button onClick={() => loadPage(cursor)} disabled={loading}>
              {loading ? "Loading..." : "Load more"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
