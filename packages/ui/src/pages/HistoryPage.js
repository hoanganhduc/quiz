import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUserSubmissions, githubLoginUrl, getSession, googleLoginUrl, batchDeleteMySubmissions, batchRestoreMySubmissions, batchHardDeleteMySubmissions } from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { formatDateTime } from "../utils/time";
import clsx from "clsx";
export function HistoryPage({ session, setSession }) {
    const [submissions, setSubmissions] = useState([]);
    const [cursor, setCursor] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [selected, setSelected] = useState(new Set());
    const hasSelectedDeleted = submissions.some(s => selected.has(s.submissionId) && s.deletedAt);
    const loggedIn = session && (session.provider === "github" || session.provider === "google");
    const loadPage = async (next) => {
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
        }
        catch (err) {
            setStatus({ tone: "error", text: err?.message ?? "Failed to load submissions" });
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (loggedIn) {
            void loadPage();
        }
        else {
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
        }
        catch {
            setSession(null);
        }
    };
    useEffect(() => {
        void refreshSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const toggleSelect = (id) => {
        const next = new Set(selected);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        setSelected(next);
    };
    const toggleAll = () => {
        if (selected.size === submissions.length && submissions.length > 0) {
            setSelected(new Set());
        }
        else {
            setSelected(new Set(submissions.map(s => s.submissionId)));
        }
    };
    const handleBatchAction = async (action) => {
        const ids = Array.from(selected);
        if (ids.length === 0)
            return;
        if (action === "hard-delete" && !confirm(`Are you sure you want to PERMANENTLY delete ${ids.length} submissions? This cannot be undone.`)) {
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            let res;
            if (action === "delete")
                res = await batchDeleteMySubmissions(ids);
            else if (action === "restore")
                res = await batchRestoreMySubmissions(ids);
            else
                res = await batchHardDeleteMySubmissions(ids);
            setStatus({ tone: "success", text: `Action completed: ${res.count} success, ${res.failed.length} failed.` });
            setSelected(new Set());
            void loadPage();
        }
        catch (err) {
            setStatus({ tone: "error", text: err?.message ?? "Action failed" });
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs(PageShell, { maxWidth: "4xl", className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-text", children: "Submission History" }), _jsx("p", { className: "text-sm text-textMuted", children: "Review past submissions and scores." })] }), loggedIn ? (_jsx(Badge, { tone: "success", children: session?.username ?? session?.provider })) : (_jsx(Badge, { tone: "warn", children: "Sign in required" }))] }), status ? _jsx(Alert, { tone: status.tone, children: status.text }) : null, !loggedIn ? (_jsxs(Card, { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-text", children: "Sign in to view your submission history." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "secondary", onClick: handleGithub, children: "Sign in with GitHub" }), _jsx(Button, { variant: "secondary", onClick: handleGoogle, children: "Sign in with Google" })] })] })) : null, loggedIn ? (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 bg-muted/30 p-3 rounded-lg border border-border", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm font-medium cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: submissions.length > 0 && selected.size === submissions.length, onChange: toggleAll, className: "rounded border-border text-info focus:ring-info bg-bg" }), "Select All"] }), _jsxs("label", { className: "flex items-center gap-2 text-sm font-medium cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: includeDeleted, onChange: (e) => setIncludeDeleted(e.target.checked), className: "rounded border-border text-info focus:ring-info bg-bg" }), "Show deleted items"] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { variant: "secondary", size: "sm", onClick: () => handleBatchAction("delete"), disabled: loading || selected.size === 0, children: "Delete" }), hasSelectedDeleted && (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => handleBatchAction("restore"), disabled: loading, children: "Restore" })), _jsx(Button, { variant: "danger", size: "sm", onClick: () => handleBatchAction("hard-delete"), disabled: loading || selected.size === 0, children: "Delete Permanently" })] })] })) : null, loggedIn ? (_jsxs("div", { className: "space-y-3", children: [Array.isArray(submissions) && submissions.length === 0 && !loading ? (_jsx(Card, { children: _jsx("p", { className: "text-sm text-textMuted", children: "No submissions found." }) })) : ((Array.isArray(submissions) ? submissions : []).map((s) => (_jsxs(Card, { className: clsx("flex gap-3", s.deletedAt && "bg-error/5 opacity-80"), children: [_jsx("div", { className: "pt-1", children: _jsx("input", { type: "checkbox", checked: selected.has(s.submissionId), onChange: () => toggleSelect(s.submissionId), className: "rounded border-border text-info focus:ring-info bg-bg" }) }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-text", children: formatDateTime(s.submittedAt) }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Exam: ", s.examId] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [s.deletedAt && _jsx(Badge, { tone: "error", children: "Deleted" }), _jsxs(Badge, { tone: "info", children: [s.score.correct, "/", s.score.total] })] })] }), s.version?.versionId ? (_jsxs("div", { className: "text-xs text-textMuted", children: ["Version: ", s.version.versionId] })) : null, _jsx("div", { children: _jsx(Link, { to: `/history/${s.submissionId}`, className: "text-sm text-info hover:underline", children: "View details" }) })] })] }, s.submissionId)))), cursor ? (_jsx(Button, { onClick: () => loadPage(cursor), disabled: loading, variant: "secondary", children: loading ? "Loading..." : "Load more" })) : null] })) : null] }));
}
