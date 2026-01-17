import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
import { listAdminSubmissions, batchDeleteSubmissions, batchRestoreSubmissions, batchHardDeleteSubmissions } from "../../api";
import { formatDateTime } from "../../utils/time";
import { Link } from "react-router-dom";
export function AdminSubmissionsPage() {
    const [submissions, setSubmissions] = useState([]);
    const [cursor, setCursor] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const hasSelectedDeleted = submissions.some(s => selected.has(s.submissionId) && s.deletedAt);
    const loadSubmissions = async (next) => {
        setLoading(true);
        setError(null);
        try {
            const res = await listAdminSubmissions(next);
            setSubmissions(prev => next ? [...prev, ...res.submissions] : res.submissions);
            setCursor(res.nextCursor);
        }
        catch (err) {
            setError(err?.message ?? "Failed to load submissions");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadSubmissions();
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
        if (selected.size === submissions.length) {
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
        try {
            let res;
            if (action === "delete")
                res = await batchDeleteSubmissions(ids);
            else if (action === "restore")
                res = await batchRestoreSubmissions(ids);
            else
                res = await batchHardDeleteSubmissions(ids);
            alert(`Action completed: ${res.count} success, ${res.failed.length} failed.`);
            setSelected(new Set());
            void loadSubmissions();
        }
        catch (err) {
            setError(err?.message ?? "Action failed");
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs(PageShell, { maxWidth: "6xl", className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text", children: "Manage Submissions" }), _jsx("p", { className: "text-sm text-textMuted", children: "View, delete, or restore exam submissions platform-wide." })] }), _jsx("div", { className: "flex gap-2", children: _jsx(Button, { variant: "secondary", onClick: () => void loadSubmissions(), disabled: loading, children: "Refresh" }) })] }), error && _jsx(Alert, { tone: "error", children: error }), _jsxs("div", { className: "flex flex-wrap gap-2 items-center bg-muted/50 p-3 rounded-lg border border-border", children: [_jsxs("span", { className: "text-sm font-medium mr-2", children: [selected.size, " selected"] }), _jsx(Button, { variant: "secondary", size: "sm", onClick: () => handleBatchAction("delete"), disabled: loading || selected.size === 0, children: "Delete" }), hasSelectedDeleted && (_jsx(Button, { variant: "secondary", size: "sm", onClick: () => handleBatchAction("restore"), disabled: loading, children: "Restore" })), _jsx(Button, { variant: "danger", size: "sm", onClick: () => handleBatchAction("hard-delete"), disabled: loading || selected.size === 0, children: "Delete Permanently" })] }), _jsx(Card, { padding: "none", className: "overflow-hidden border-border", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-muted text-textMuted text-xs uppercase tracking-wider border-b border-border", children: [_jsx("th", { className: "px-4 py-3 w-10", children: _jsx("input", { type: "checkbox", checked: submissions.length > 0 && selected.size === submissions.length, onChange: toggleAll, className: "rounded border-border text-info focus:ring-info bg-bg" }) }), _jsx("th", { className: "px-4 py-3", children: "User / Identity" }), _jsx("th", { className: "px-4 py-3", children: "Exam ID" }), _jsx("th", { className: "px-4 py-3", children: "Score" }), _jsx("th", { className: "px-4 py-3", children: "Submitted At" }), _jsx("th", { className: "px-4 py-3", children: "Status" }), _jsx("th", { className: "px-4 py-3 text-right", children: "Actions" })] }) }), _jsxs("tbody", { className: "divide-y divide-border", children: [submissions.map((s) => (_jsxs("tr", { className: `hover:bg-muted/30 transition-colors ${s.deletedAt ? 'bg-error/5 opacity-80' : ''}`, children: [_jsx("td", { className: "px-4 py-3", children: _jsx("input", { type: "checkbox", checked: selected.has(s.submissionId), onChange: () => toggleSelect(s.submissionId), className: "rounded border-border text-info focus:ring-info bg-bg" }) }), _jsxs("td", { className: "px-4 py-3", children: [_jsx("div", { className: "text-sm font-medium text-text", children: s.identity?.name || s.identity?.username || "Anonymous" }), _jsx("div", { className: "text-xs text-textMuted", children: s.identity?.email || s.submissionId })] }), _jsx("td", { className: "px-4 py-3 font-mono text-xs", children: s.examId }), _jsx("td", { className: "px-4 py-3", children: _jsxs(Badge, { tone: s.score.correct === s.score.total ? "success" : "info", children: [s.score.correct, "/", s.score.total] }) }), _jsx("td", { className: "px-4 py-3 text-sm", children: formatDateTime(s.submittedAt) }), _jsx("td", { className: "px-4 py-3 text-sm", children: s.deletedAt ? (_jsx(Badge, { tone: "error", children: "Deleted" })) : (_jsx(Badge, { tone: "success", children: "Active" })) }), _jsx("td", { className: "px-4 py-3 text-right space-x-2", children: _jsx(Link, { to: `/history/${s.submissionId}`, className: "text-xs text-info hover:underline", children: "View" }) })] }, s.submissionId))), submissions.length === 0 && !loading && (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-4 py-8 text-center text-textMuted italic", children: "No submissions found." }) }))] })] }) }) }), cursor && (_jsx("div", { className: "flex justify-center pt-4", children: _jsx(Button, { onClick: () => void loadSubmissions(cursor), disabled: loading, variant: "secondary", children: loading ? "Loading..." : "Load more" }) }))] }));
}
