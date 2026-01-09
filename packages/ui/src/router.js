import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { HashRouter, Route, Routes, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ExamPage } from "./pages/ExamPage";
import { Card } from "./components/ui/Card";
import { AdminHome } from "./pages/admin/AdminHome";
import { CreateExamPage } from "./pages/admin/CreateExamPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { SourcesManagerPage } from "./pages/admin/SourcesManagerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { TopBar } from "./components/layout/TopBar";
import { PageShell } from "./components/layout/PageShell";
import { StepIndicator } from "./components/ui/StepIndicator";
const showAdminLink = new URLSearchParams(window.location.search).get("admin") === "1";
function Home() {
    const [examId, setExamId] = useState("");
    const navigate = useNavigate();
    const parseExamId = (raw) => {
        const trimmed = raw.trim();
        if (!trimmed)
            return "";
        try {
            const u = new URL(trimmed);
            const m = (u.hash ?? "").match(/#\/exam\/([^/?]+)/);
            if (m)
                return decodeURIComponent(m[1]);
        }
        catch {
            // not a full URL
        }
        const m = trimmed.match(/#\/exam\/([^/?]+)/) ?? trimmed.match(/\/exam\/([^/?]+)/);
        if (m)
            return decodeURIComponent(m[1]);
        return trimmed;
    };
    const go = () => {
        const id = parseExamId(examId);
        if (!id)
            return;
        navigate(`/exam/${encodeURIComponent(id)}`);
    };
    return (_jsxs(PageShell, { maxWidth: "4xl", className: "space-y-4", children: [_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h2", { className: "text-xl font-semibold text-text", children: "Start an exam" }), _jsxs("p", { className: "text-sm text-textMuted", children: ["Paste the link your instructor gave you, or enter the exam ID. If you get asked for a ", _jsx("strong", { children: "view code" }), " or", _jsx("strong", { children: " submit code" }), ", you\u2019ll enter it after opening the exam."] }), _jsxs("p", { className: "text-xs text-textMuted", children: ["Need help? Use ", _jsx("strong", { children: "Help" }), " in the top bar."] })] }), _jsxs("div", { className: "grid gap-2 sm:grid-cols-[1fr_auto] items-end", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "exam-id", children: "Exam link or ID" }), _jsx(Input, { id: "exam-id", value: examId, onChange: (e) => setExamId(e.target.value), placeholder: "Paste link (/#/exam/abc123) or enter ID (abc123)", onKeyDown: (e) => (e.key === "Enter" ? go() : null) }), _jsx("div", { className: "text-xs text-textMuted", children: "We\u2019ll extract the exam ID automatically if you paste a full link." })] }), _jsx(Button, { type: "button", onClick: go, disabled: !parseExamId(examId), children: "Open exam" })] }), _jsxs("div", { className: "rounded-xl border border-border bg-muted p-4", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "What happens next" }), _jsx(StepIndicator, { className: "mt-3", steps: [
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
                                ] })] })] }), showAdminLink ? (_jsx("div", { className: "text-xs text-textMuted", children: _jsx(Link, { to: "/admin", className: "hover:underline", children: "Admin" }) })) : null] }));
}
export function AppRouter({ session, setSession }) {
    return (_jsx(HashRouter, { children: _jsxs("div", { className: "min-h-screen bg-bg", children: [_jsx(TopBar, { session: session }), _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/exam/:examId", element: _jsx(ExamPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/history", element: _jsx(HistoryPage, { session: session, setSession: setSession }) }), _jsx(Route, { path: "/account", element: _jsx(AccountPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) }), _jsx(Route, { path: "/admin", element: _jsx(AdminHome, {}) }), _jsx(Route, { path: "/admin/exams/new", element: _jsx(CreateExamPage, {}) }), _jsx(Route, { path: "/admin/users", element: _jsx(AdminUsersPage, {}) }), _jsx(Route, { path: "/admin/sources", element: _jsx(SourcesManagerPage, {}) })] })] }) }));
}
