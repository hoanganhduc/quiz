import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { HashRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getDefaultTimeFormat, getDefaultTimezone, listPublicExams } from "./api";
import { ExamPage } from "./pages/ExamPage";
import { Card } from "./components/ui/Card";
import { AdminHome } from "./pages/admin/AdminHome";
import { AdminExamsPage } from "./pages/admin/AdminExamsPage";
import { CreateExamPage } from "./pages/admin/CreateExamPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { SourcesManagerPage } from "./pages/admin/SourcesManagerPage";
import { AdminSubmissionsPage } from "./pages/admin/AdminSubmissionsPage";
import { ExtraToolsPage } from "./pages/admin/ExtraToolsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SubmissionDetailPage } from "./pages/SubmissionDetailPage";
import { ShortLinkRedirect } from "./pages/ShortLinkRedirect";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { TopBar } from "./components/layout/TopBar";
import { PageShell } from "./components/layout/PageShell";
import { StepIndicator } from "./components/ui/StepIndicator";
import { initDefaultTimeFormat, initDefaultTimezone, onTimeFormatChange, onTimezoneChange } from "./utils/time";
import { ExamListItem } from "./components/ExamListItem";
const showAdminLink = new URLSearchParams(window.location.search).get("admin") === "1";
function Home() {
    const [examId, setExamId] = useState("");
    const [openExams, setOpenExams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const navigate = useNavigate();
    const parseExamLink = (raw) => {
        const trimmed = raw.trim();
        if (!trimmed)
            return null;
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
        }
        catch {
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
        if (!parsed)
            return;
        navigate(`/exam/${encodeURIComponent(parsed.subject)}/${encodeURIComponent(parsed.examId)}`);
    };
    const loadExams = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await listPublicExams();
            setOpenExams(res.items ?? []);
        }
        catch (err) {
            setError(err?.message ?? "Failed to load open exams.");
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadExams();
    }, []);
    return (_jsxs(PageShell, { maxWidth: "4xl", className: "space-y-8 w-full", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-bold text-text mb-2", children: "Welcome to Quiz Platform" }), _jsx("p", { className: "text-textMuted max-w-2xl", children: "Access your assigned exams or practice with public available tests." })] }), notice && (_jsxs("div", { className: `p-4 rounded-lg flex items-center justify-between ${notice.tone === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`, children: [_jsx("span", { children: notice.text }), _jsx("button", { onClick: () => setNotice(null), className: "ml-4 text-sm font-medium hover:underline", children: "Dismiss" })] })), _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h2", { className: "text-xl font-semibold text-text", children: "Start an exam" }), _jsxs("p", { className: "text-sm text-textMuted", children: ["Paste the link your instructor gave you, or enter the exam ID. If you get asked for a ", _jsx("strong", { children: "view code" }), " or", _jsx("strong", { children: " submit code" }), ", you\u2019ll enter it after opening the exam."] }), _jsxs("p", { className: "text-xs text-textMuted", children: ["Need help? Use ", _jsx("strong", { children: "Help" }), " in the top bar."] })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_auto] items-end", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "exam-id", children: "Exam link or ID" }), _jsx(Input, { id: "exam-id", value: examId, onChange: (e) => setExamId(e.target.value), placeholder: "Paste link (/#/exam/discrete-math/abc123) or enter ID (abc123)", onKeyDown: (e) => (e.key === "Enter" ? go() : null) }), _jsx("div", { className: "text-xs text-textMuted", children: "We\u2019ll extract the exam ID automatically if you paste a full link." })] }), _jsx(Button, { type: "button", onClick: go, disabled: !parseExamLink(examId), children: "Open exam" })] }), _jsxs("div", { className: "rounded-xl border border-border bg-muted p-4", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "What happens next" }), _jsx(StepIndicator, { className: "mt-3", steps: [
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
                                ] })] })] }), _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Open exams" }), _jsx("p", { className: "text-sm text-textMuted", children: "Public exams that don\u2019t require sign-in or access codes." })] }), error ? _jsx("div", { className: "text-sm text-error", children: error }) : null, loading ? (_jsx("div", { className: "text-sm text-textMuted", children: "Loading open exams..." })) : openExams.length ? (_jsx("div", { className: "space-y-2 text-sm", children: openExams.map((exam) => (_jsx(ExamListItem, { exam: exam, onLinkClick: undefined, actions: [
                                {
                                    label: "Open",
                                    onClick: () => navigate(`/exam/${encodeURIComponent(exam.subject)}/${encodeURIComponent(exam.examId)}`)
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
                                        }
                                        catch {
                                            setNotice({ tone: "error", text: "Failed to copy link" });
                                        }
                                    }
                                },
                                ...(exam.shortLinkCode ? [{
                                        label: "Copy short link",
                                        variant: "secondary",
                                        onClick: async () => {
                                            const url = `${window.location.origin}/#/s/${exam.shortLinkCode}`;
                                            try {
                                                await navigator.clipboard.writeText(url);
                                                setNotice({ tone: "success", text: "Short link copied to clipboard" });
                                                setTimeout(() => setNotice(null), 3000);
                                            }
                                            catch {
                                                setNotice({ tone: "error", text: "Failed to copy short link" });
                                            }
                                        }
                                    }] : [])
                            ] }, exam.examId))) })) : (_jsx("div", { className: "text-sm text-textMuted", children: "No open exams right now." }))] }), showAdminLink ? (_jsx("div", { className: "text-xs text-textMuted", children: _jsx(Link, { to: "/admin", className: "hover:underline", children: "Admin" }) })) : null] }));
}
export function AppRouter({ session, setSession }) {
    const [, setTimezoneTick] = useState(0);
    useEffect(() => {
        void initDefaultTimezone(getDefaultTimezone);
        void initDefaultTimeFormat(getDefaultTimeFormat);
    }, []);
    useEffect(() => onTimezoneChange(() => setTimezoneTick((v) => v + 1)), []);
    useEffect(() => onTimeFormatChange(() => setTimezoneTick((v) => v + 1)), []);
    return (_jsx(HashRouter, { children: _jsxs("div", { className: "min-h-screen bg-bg", children: [_jsx(TopBar, { session: session }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/exam/:subject/:examId", element: _jsx(ExamPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/exam/:examId", element: _jsx(ExamPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/s/:code", element: _jsx(ShortLinkRedirect, {}) }), _jsx(Route, { path: "/history", element: _jsx(HistoryPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/history/:submissionId", element: _jsx(SubmissionDetailPage, {}) }), _jsx(Route, { path: "/account", element: _jsx(AccountPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "/admin", element: _jsx(AdminHome, {}) }), _jsx(Route, { path: "/admin/exams", element: _jsx(AdminExamsPage, {}) }), _jsx(Route, { path: "/admin/exams/new", element: _jsx(CreateExamPage, {}) }), _jsx(Route, { path: "/admin/users", element: _jsx(AdminUsersPage, {}) }), _jsx(Route, { path: "/admin/submissions", element: _jsx(AdminSubmissionsPage, {}) }), _jsx(Route, { path: "/admin/sources", element: _jsx(SourcesManagerPage, {}) }), _jsx(Route, { path: "/admin/tools", element: _jsx(ExtraToolsPage, {}) })] })] }) }));
}
