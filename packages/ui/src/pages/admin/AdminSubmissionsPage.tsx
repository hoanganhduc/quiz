import { useEffect, useState } from "react";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import {
    listAdminSubmissions,
    batchDeleteSubmissions,
    batchRestoreSubmissions,
    batchHardDeleteSubmissions,
    SubmissionDetail
} from "../../api";
import { formatDateTime } from "../../utils/time";
import { Link } from "react-router-dom";

export function AdminSubmissionsPage() {
    const [submissions, setSubmissions] = useState<SubmissionDetail[]>([]);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const hasSelectedDeleted = submissions.some(s => selected.has(s.submissionId) && s.deletedAt);

    const loadSubmissions = async (next?: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await listAdminSubmissions(next);
            setSubmissions(prev => next ? [...prev, ...res.submissions] : res.submissions);
            setCursor(res.nextCursor);
        } catch (err: any) {
            setError(err?.message ?? "Failed to load submissions");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSubmissions();
    }, []);

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelected(next);
    };

    const toggleAll = () => {
        if (selected.size === submissions.length) {
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
        try {
            let res;
            if (action === "delete") res = await batchDeleteSubmissions(ids);
            else if (action === "restore") res = await batchRestoreSubmissions(ids);
            else res = await batchHardDeleteSubmissions(ids);

            alert(`Action completed: ${res.count} success, ${res.failed.length} failed.`);
            setSelected(new Set());
            void loadSubmissions();
        } catch (err: any) {
            setError(err?.message ?? "Action failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageShell maxWidth="6xl" className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text">Manage Submissions</h1>
                    <p className="text-sm text-textMuted">View, delete, or restore exam submissions platform-wide.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => void loadSubmissions()} disabled={loading}>
                        Refresh
                    </Button>
                </div>
            </div>

            {error && <Alert tone="error">{error}</Alert>}

            <div className="flex flex-wrap gap-2 items-center bg-muted/50 p-3 rounded-lg border border-border">
                <span className="text-sm font-medium mr-2">{selected.size} selected</span>
                <Button variant="secondary" size="sm" onClick={() => handleBatchAction("delete")} disabled={loading || selected.size === 0}>
                    Delete
                </Button>
                {hasSelectedDeleted && (
                    <Button variant="secondary" size="sm" onClick={() => handleBatchAction("restore")} disabled={loading}>
                        Restore
                    </Button>
                )}
                <Button variant="danger" size="sm" onClick={() => handleBatchAction("hard-delete")} disabled={loading || selected.size === 0}>
                    Delete Permanently
                </Button>
            </div>

            <Card padding="none" className="overflow-hidden border-border">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-muted text-textMuted text-xs uppercase tracking-wider border-b border-border">
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={submissions.length > 0 && selected.size === submissions.length}
                                        onChange={toggleAll}
                                        className="rounded border-border text-info focus:ring-info bg-bg"
                                    />
                                </th>
                                <th className="px-4 py-3">User / Identity</th>
                                <th className="px-4 py-3">Exam ID</th>
                                <th className="px-4 py-3">Score</th>
                                <th className="px-4 py-3">Submitted At</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {submissions.map((s) => (
                                <tr key={s.submissionId} className={`hover:bg-muted/30 transition-colors ${s.deletedAt ? 'bg-error/5 opacity-80' : ''}`}>
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selected.has(s.submissionId)}
                                            onChange={() => toggleSelect(s.submissionId)}
                                            className="rounded border-border text-info focus:ring-info bg-bg"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm font-medium text-text">{(s as any).identity?.name || (s as any).identity?.username || "Anonymous"}</div>
                                        <div className="text-xs text-textMuted">{(s as any).identity?.email || s.submissionId}</div>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">{s.examId}</td>
                                    <td className="px-4 py-3">
                                        <Badge tone={s.score.correct === s.score.total ? "success" : "info"}>
                                            {s.score.correct}/{s.score.total}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{formatDateTime(s.submittedAt)}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {s.deletedAt ? (
                                            <Badge tone="error">Deleted</Badge>
                                        ) : (
                                            <Badge tone="success">Active</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <Link to={`/history/${s.submissionId}`} className="text-xs text-info hover:underline">
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {submissions.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-textMuted italic">
                                        No submissions found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {cursor && (
                <div className="flex justify-center pt-4">
                    <Button onClick={() => void loadSubmissions(cursor)} disabled={loading} variant="secondary">
                        {loading ? "Loading..." : "Load more"}
                    </Button>
                </div>
            )}
        </PageShell>
    );
}
