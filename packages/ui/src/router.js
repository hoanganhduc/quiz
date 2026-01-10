import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { HashRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getDefaultTimezone, listPublicExams } from "./api";
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
import { formatDateTime, initDefaultTimezone } from "./utils/time";
const showAdminLink = new URLSearchParams(window.location.search).get("admin") === "1";
function Home() {
    const [examId, setExamId] = useState("");
    const [openExams, setOpenExams] = useState([]);
    const [openLoading, setOpenLoading] = useState(false);
    const [openError, setOpenError] = useState(null);
    const navigate = useNavigate();
    const parseExamLink = (raw) => {
        var _a, _b, _c, _d;
        const trimmed = raw.trim();
        if (!trimmed)
            return null;
        try {
            const u = new URL(trimmed);
            const m = ((_a = u.hash) !== null && _a !== void 0 ? _a : "").match(/#\/exam\/([^/?]+)\/([^/?]+)/);
            if (m) {
                return { subject: decodeURIComponent(m[1]), examId: decodeURIComponent(m[2]) };
            }
            const legacy = ((_b = u.hash) !== null && _b !== void 0 ? _b : "").match(/#\/exam\/([^/?]+)/);
            if (legacy) {
                return { subject: "discrete-math", examId: decodeURIComponent(legacy[1]) };
            }
        }
        catch {
            // not a full URL
        }
        const m = (_c = trimmed.match(/#\/exam\/([^/?]+)\/([^/?]+)/)) !== null && _c !== void 0 ? _c : trimmed.match(/\/exam\/([^/?]+)\/([^/?]+)/);
        if (m) {
            return { subject: decodeURIComponent(m[1]), examId: decodeURIComponent(m[2]) };
        }
        const legacy = (_d = trimmed.match(/#\/exam\/([^/?]+)/)) !== null && _d !== void 0 ? _d : trimmed.match(/\/exam\/([^/?]+)/);
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
    const formatDate = (value) => {
        if (!value)
            return "—";
        return formatDateTime(value);
    };
    useEffect(() => {
        setOpenLoading(true);
        listPublicExams()
            .then((res) => {
            var _a;
            setOpenExams((_a = res.items) !== null && _a !== void 0 ? _a : []);
            setOpenError(null);
        })
            .catch((err) => {
            var _a;
            setOpenError((_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : "Failed to load open exams.");
        })
            .finally(() => {
            setOpenLoading(false);
        });
    }, []);
    return (_jsxs(PageShell, { maxWidth: "4xl", className: "space-y-4", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h2", { className: "text-xl font-semibold text-text", children: "Start an exam" }), _jsxs("p", { className: "text-sm text-textMuted", children: ["Paste the link your instructor gave you, or enter the exam ID. If you get asked for a ", _jsx("strong", { children: "view code" }), " or", _jsx("strong", { children: " submit code" }), ", you\u2019ll enter it after opening the exam."] }), _jsxs("p", { className: "text-xs text-textMuted", children: ["Need help? Use ", _jsx("strong", { children: "Help" }), " in the top bar."] })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_auto] items-end", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "exam-id", children: "Exam link or ID" }), _jsx(Input, { id: "exam-id", value: examId, onChange: (e) => setExamId(e.target.value), placeholder: "Paste link (/#/exam/discrete-math/abc123) or enter ID (abc123)", onKeyDown: (e) => (e.key === "Enter" ? go() : null) }), _jsx("div", { className: "text-xs text-textMuted", children: "We\u2019ll extract the exam ID automatically if you paste a full link." })] }), _jsx(Button, { type: "button", onClick: go, disabled: !parseExamLink(examId), children: "Open exam" })] }), _jsxs("div", { className: "rounded-xl border border-border bg-muted p-4", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "What happens next" }), _jsx(StepIndicator, { className: "mt-3", steps: [
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
                                ] })] })] }), _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Open exams" }), _jsx("p", { className: "text-sm text-textMuted", children: "Public exams that don\u2019t require sign-in or access codes." })] }), openError ? _jsx("div", { className: "text-sm text-error", children: openError }) : null, openLoading ? (_jsx("div", { className: "text-sm text-textMuted", children: "Loading open exams..." })) : openExams.length ? (_jsx("div", { className: "space-y-2 text-sm", children: openExams.map((exam) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "font-medium text-text", children: ["Exam ", exam.examId] }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Created ", formatDate(exam.createdAt), " \u00B7 Expires ", formatDate(exam.expiresAt)] })] }), _jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => navigate(`/exam/${encodeURIComponent(exam.subject)}/${encodeURIComponent(exam.examId)}`), children: "Open" })] }, exam.examId))) })) : (_jsx("div", { className: "text-sm text-textMuted", children: "No open exams right now." }))] }), showAdminLink ? (_jsx("div", { className: "text-xs text-textMuted", children: _jsx(Link, { to: "/admin", className: "hover:underline", children: "Admin" }) })) : null] }));
}
export function AppRouter({ session, setSession }) {
    useEffect(() => {
        void initDefaultTimezone(getDefaultTimezone);
    }, []);
    return (_jsx(HashRouter, { children: _jsxs("div", { className: "min-h-screen bg-bg", children: [_jsx(TopBar, { session: session }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/exam/:subject/:examId", element: _jsx(ExamPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/exam/:examId", element: _jsx(ExamPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/s/:code", element: _jsx(ShortLinkRedirect, {}) }), _jsx(Route, { path: "/history", element: _jsx(HistoryPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/account", element: _jsx(AccountPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "/admin", element: _jsx(AdminHome, {}) }), _jsx(Route, { path: "/admin/exams", element: _jsx(AdminExamsPage, {}) }), _jsx(Route, { path: "/admin/exams/new", element: _jsx(CreateExamPage, {}) }), _jsx(Route, { path: "/admin/users", element: _jsx(AdminUsersPage, {}) }), _jsx(Route, { path: "/admin/sources", element: _jsx(SourcesManagerPage, {}) }), _jsx(Route, { path: "/admin/tools", element: _jsx(ExtraToolsPage, {}) })] })] }) }));
}
