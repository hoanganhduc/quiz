import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getUserSubmissions, githubLoginUrl, getSession, googleLoginUrl } from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { formatDateTime } from "../utils/time";
export function HistoryPage({ session, setSession }) {
    const [submissions, setSubmissions] = useState([]);
    const [cursor, setCursor] = useState(undefined);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const loggedIn = session && (session.provider === "github" || session.provider === "google");
    const loadPage = async (next) => {
        setLoading(true);
        setStatus(null);
        try {
            const res = await getUserSubmissions(next);
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
        }
        catch {
            setSession(null);
        }
    };
    useEffect(() => {
        void refreshSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (_jsxs(PageShell, { maxWidth: "4xl", className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-text", children: "Submission History" }), _jsx("p", { className: "text-sm text-textMuted", children: "Review past submissions and scores." })] }), loggedIn ? (_jsx(Badge, { tone: "success", children: session?.username ?? session?.provider })) : (_jsx(Badge, { tone: "warn", children: "Sign in required" }))] }), status ? _jsx(Alert, { tone: status.tone, children: status.text }) : null, !loggedIn ? (_jsxs(Card, { className: "space-y-3", children: [_jsx("p", { className: "text-sm text-text", children: "Sign in to view your submission history." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "secondary", onClick: handleGithub, children: "Sign in with GitHub" }), _jsx(Button, { variant: "secondary", onClick: handleGoogle, children: "Sign in with Google" })] })] })) : null, loggedIn ? (_jsxs("div", { className: "space-y-3", children: [Array.isArray(submissions) && submissions.length === 0 && !loading ? (_jsx(Card, { children: _jsx("p", { className: "text-sm text-textMuted", children: "No submissions yet." }) })) : ((Array.isArray(submissions) ? submissions : []).map((s) => (_jsxs(Card, { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-text", children: formatDateTime(s.submittedAt) }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Exam: ", s.examId] })] }), _jsxs(Badge, { tone: "info", children: [s.score.correct, "/", s.score.total] })] }), s.version?.versionId ? (_jsxs("div", { className: "text-xs text-textMuted", children: ["Version: ", s.version.versionId] })) : null, _jsx("div", { children: _jsx(Link, { to: `/history/${s.submissionId}`, className: "text-sm text-info hover:underline", children: "View details" }) })] }, s.submissionId)))), cursor ? (_jsx(Button, { onClick: () => loadPage(cursor), disabled: loading, children: loading ? "Loading..." : "Load more" })) : null] })) : null] }));
}
