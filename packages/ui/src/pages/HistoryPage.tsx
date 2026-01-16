import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getUserSubmissions,
  githubLoginUrl,
  Session,
  SessionUser,
  getSession,
  googleLoginUrl,
  batchDeleteMySubmissions,
  batchRestoreMySubmissions,
  batchHardDeleteMySubmissions,
  SubmissionSummary
} from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { formatDateTime } from "../utils/time";
import clsx from "clsx";

type StatusTone = "info" | "warn" | "error" | "success";
type StatusMessage = { tone: StatusTone; text: string } | null;

type Props = { session: Session | null; setSession: (s: Session | null) => void };

export function HistoryPage({ session, setSession }: Props) {
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loggedIn =
    session && (session.provider === "github" || session.provider === "google");

  const loadPage = async (next?: string) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await getUserSubmissions(next, includeDeleted);
      const nextSubs = Array.isArray(res.submissions) ? res.submissions : [];
      setSubmissions((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return next ? [...safePrev, ...nextSubs] : nextSubs;
      });
      setCursor(res.nextCursor);
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
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, includeDeleted]);

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

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === submissions.length && submissions.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(submissions.map(s => s.submissionId)));
    }
  };

  const handleBatchAction = async (action: "delete" | "restore" | "hard-delete") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    if (action === "hard-delete" && !confirm(`Are you sure you want to PERMANENTLY delete ${ids.length} submissions? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      let res;
      if (action === "delete") res = await batchDeleteMySubmissions(ids);
      else if (action === "restore") res = await batchRestoreMySubmissions(ids);
      else res = await batchHardDeleteMySubmissions(ids);

      setStatus({ tone: "success", text: `Action completed: ${res.count} success, ${res.failed.length} failed.` });
      setSelected(new Set());
      void loadPage();
    } catch (err: any) {
      setStatus({ tone: "error", text: err?.message ?? "Action failed" });
    } finally {
      setLoading(false);
    }
  };

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
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border border-border">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={submissions.length > 0 && selected.size === submissions.length}
                onChange={toggleAll}
                className="rounded border-border text-info focus:ring-info bg-bg"
              />
              Select All
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="rounded border-border text-info focus:ring-info bg-bg"
              />
              Show deleted items
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleBatchAction("delete")} disabled={loading || selected.size === 0}>
              Soft Delete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleBatchAction("restore")} disabled={loading || selected.size === 0}>
              Restore
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleBatchAction("hard-delete")} disabled={loading || selected.size === 0}>
              Hard Delete
            </Button>
          </div>
        </div>
      ) : null}

      {loggedIn ? (
        <div className="space-y-3">
          {Array.isArray(submissions) && submissions.length === 0 && !loading ? (
            <Card>
              <p className="text-sm text-textMuted">No submissions found.</p>
            </Card>
          ) : (
            (Array.isArray(submissions) ? submissions : []).map((s) => (
              <Card key={s.submissionId} className={clsx("flex gap-3", s.deletedAt && "bg-error/5 opacity-80")}>
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={selected.has(s.submissionId)}
                    onChange={() => toggleSelect(s.submissionId)}
                    className="rounded border-border text-info focus:ring-info bg-bg"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-text">{formatDateTime(s.submittedAt)}</div>
                      <div className="text-xs text-textMuted">Exam: {s.examId}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.deletedAt && <Badge tone="error">Deleted</Badge>}
                      <Badge tone="info">
                        {s.score.correct}/{s.score.total}
                      </Badge>
                    </div>
                  </div>
                  {s.version?.versionId ? (
                    <div className="text-xs text-textMuted">Version: {s.version.versionId}</div>
                  ) : null}
                  <div>
                    <Link to={`/history/${s.submissionId}`} className="text-sm text-info hover:underline">
                      View details
                    </Link>
                  </div>
                </div>
              </Card>
            ))
          )}
          {cursor ? (
            <Button onClick={() => loadPage(cursor)} disabled={loading} variant="secondary">
              {loading ? "Loading..." : "Load more"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  );
}
