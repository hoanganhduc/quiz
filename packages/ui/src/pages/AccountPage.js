import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { IconLink } from "../components/ui/Icons";
import { Badge } from "../components/ui/Badge";
import { PageShell } from "../components/layout/PageShell";
import { getSession, githubLinkUrl, googleLinkUrl } from "../api";
export function AccountPage() {
    const [session, setSession] = useState(null);
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const apiBase = import.meta.env.VITE_API_BASE;
    useEffect(() => {
        setLoading(true);
        getSession()
            .then((sess) => setSession(sess))
            .catch(() => setSession(null))
            .finally(() => setLoading(false));
    }, []);
    const providers = session?.providers ?? (session?.provider ? [session.provider] : []);
    const isLinkedGithub = providers.includes("github");
    const isLinkedGoogle = providers.includes("google");
    const handleGithubLink = () => {
        window.location.href = githubLinkUrl(window.location.href);
    };
    const handleGoogleLink = () => {
        if (!apiBase) {
            setStatus({ tone: "error", text: "API base not configured" });
            return;
        }
        window.location.href = googleLinkUrl(window.location.href);
    };
    return (_jsxs(PageShell, { maxWidth: "3xl", className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-text", children: "Account" }), _jsx("p", { className: "text-sm text-textMuted", children: "Manage linked providers and session." })] }), status ? _jsx(Alert, { tone: status.tone, children: status.text }) : null, _jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Linked providers" }), _jsx("p", { className: "text-sm text-textMuted", children: "Link accounts for sign-in flexibility." })] }), session?.roles?.includes("admin") ? _jsx(Badge, { tone: "info", children: "Admin" }) : null] }), loading ? (_jsx("p", { className: "text-sm text-textMuted", children: "Loading session..." })) : session ? (_jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Badge, { tone: isLinkedGithub ? "success" : "muted", children: "GitHub" }), _jsx(Badge, { tone: isLinkedGoogle ? "success" : "muted", children: "Google" }), !isLinkedGithub && !isLinkedGoogle ? _jsx(Badge, { tone: "warn", children: "No providers linked" }) : null] })) : (_jsx(Alert, { tone: "warn", children: "Not logged in. Sign in via an exam page to link providers." })), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "secondary", icon: _jsx(IconLink, { className: "h-4 w-4" }), onClick: handleGithubLink, disabled: !session || isLinkedGithub, children: isLinkedGithub ? "GitHub linked" : "Link GitHub" }), _jsx(Button, { variant: "secondary", icon: _jsx(IconLink, { className: "h-4 w-4" }), onClick: handleGoogleLink, disabled: !session || isLinkedGoogle, children: isLinkedGoogle ? "Google linked" : "Link Google" })] })] })] }));
}
