import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { githubLoginUrl, googleLoginUrl } from "../../api";
export function AdminAuthGate({ children }) {
    const [session, setSession] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const apiBase = import.meta.env.VITE_API_BASE;
    const loadSession = async () => {
        if (!apiBase) {
            setStatus({ tone: "error", text: "API base not configured" });
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/auth/me`, { credentials: "include" });
            if (!res.ok)
                throw new Error(await res.text());
            const data = (await res.json());
            setSession(data.session);
        }
        catch (err) {
            setStatus({ tone: "error", text: err?.message ?? "Failed to load session" });
            setSession(null);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        void loadSession();
    }, []);
    const handleGithubLogin = () => {
        window.location.href = githubLoginUrl(window.location.href);
    };
    const handleGoogleLogin = () => {
        if (!apiBase) {
            setStatus({ tone: "error", text: "API base not configured" });
            return;
        }
        window.location.href = googleLoginUrl(window.location.href);
    };
    if (loading) {
        return _jsx("div", { className: "p-6 text-sm text-textMuted", children: "Loading admin session..." });
    }
    if (!session) {
        return (_jsx("div", { className: "mx-auto max-w-3xl px-4 py-8 space-y-4", children: _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Admin sign-in required" }), _jsx("p", { className: "text-sm text-textMuted", children: "Sign in to manage admin tools." })] }), status ? _jsx(Alert, { tone: status.tone, children: status.text }) : null, _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "secondary", onClick: handleGithubLogin, children: "Sign in with GitHub" }), _jsx(Button, { variant: "secondary", onClick: handleGoogleLogin, children: "Sign in with Google" })] })] }) }));
    }
    const isAdmin = session.roles?.includes("admin");
    if (!isAdmin) {
        return (_jsx("div", { className: "mx-auto max-w-3xl px-4 py-8 space-y-4", children: _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Not authorized" }), _jsx("p", { className: "text-sm text-textMuted", children: "Your account does not have admin access." })] }), _jsx(Badge, { tone: "warn", children: "No admin role" })] })] }) }));
    }
    return _jsx("div", { className: "pt-3", children: children });
}
