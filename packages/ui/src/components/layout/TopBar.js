import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import clsx from "clsx";
import { githubLoginUrl, googleLoginUrl } from "../../api";
import { Badge } from "../ui/Badge";
import { IconClock, IconLogin, IconLogout, IconPlay, IconQuestion, IconSettings, IconShield, IconUser } from "../ui/Icons";
import { HelpDrawer } from "./HelpDrawer";
function navLinkClass({ isActive }) {
    return clsx("inline-flex items-center rounded-lg px-3 py-2 text-sm border", "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900", isActive
        ? "bg-muted border-border text-text"
        : "bg-transparent border-transparent hover:bg-muted text-textMuted");
}
export function TopBar({ session }) {
    const [helpOpen, setHelpOpen] = useState(false);
    const isAdmin = !!session?.roles?.includes("admin");
    const apiBase = import.meta.env.VITE_API_BASE;
    const displayName = !session
        ? null
        : session.provider === "anon"
            ? "Anonymous"
            : session.displayName ?? session.name ?? session.username ?? "User";
    const handleLogout = async () => {
        if (!apiBase)
            return;
        await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" });
        window.location.reload();
    };
    const startGithubLogin = () => {
        if (!apiBase)
            return;
        window.location.href = githubLoginUrl(window.location.href);
    };
    const startGoogleLogin = () => {
        if (!apiBase)
            return;
        window.location.href = googleLoginUrl(window.location.href);
    };
    return (_jsxs(_Fragment, { children: [_jsx("header", { className: "sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur", children: _jsxs("div", { className: "mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx(Link, { to: "/", className: "font-semibold text-text", children: "Quiz" }), _jsxs("nav", { className: "flex flex-wrap items-center gap-1", children: [_jsx(NavLink, { to: "/", className: navLinkClass, end: true, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconPlay, { className: "h-4 w-4" }), _jsx("span", { children: "Take Exam" })] }) }), session ? (_jsxs(_Fragment, { children: [_jsx(NavLink, { to: "/history", className: navLinkClass, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconClock, { className: "h-4 w-4" }), _jsx("span", { children: "My History" })] }) }), _jsx(NavLink, { to: "/account", className: navLinkClass, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconUser, { className: "h-4 w-4" }), _jsx("span", { children: "Account" })] }) }), isAdmin ? (_jsx(NavLink, { to: "/admin", className: navLinkClass, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconShield, { className: "h-4 w-4" }), _jsx("span", { children: "Admin" })] }) })) : null, _jsx(NavLink, { to: "/settings", className: navLinkClass, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconSettings, { className: "h-4 w-4" }), _jsx("span", { children: "Settings" })] }) })] })) : null] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", className: navLinkClass({ isActive: false }), onClick: () => setHelpOpen(true), children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconQuestion, { className: "h-4 w-4" }), _jsx("span", { children: "Help" })] }) }), session ? (_jsxs(_Fragment, { children: [_jsxs(Link, { to: "/account", className: "inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-text hover:bg-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900", children: [_jsx("span", { className: "truncate max-w-[200px]", children: displayName }), _jsx(Badge, { tone: isAdmin ? "info" : "muted", children: isAdmin ? "Admin" : "User" })] }), _jsx("button", { type: "button", className: navLinkClass({ isActive: false }), onClick: handleLogout, children: _jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconLogout, { className: "h-4 w-4" }), _jsx("span", { children: "Logout" })] }) })] })) : (_jsx(_Fragment, { children: _jsxs("details", { className: "relative", children: [_jsx("summary", { className: clsx(navLinkClass({ isActive: false }), "cursor-pointer list-none [&_::-webkit-details-marker]:hidden"), children: "Sign in" }), _jsxs("div", { className: "absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-[0_12px_32px_rgba(0,0,0,0.20)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.60)]", children: [_jsx("div", { className: "px-3 py-2 text-xs font-medium text-textMuted", children: "Sign in with" }), _jsxs("div", { className: "p-1 space-y-1", children: [_jsx("button", { type: "button", disabled: !apiBase, className: "w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-muted hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50", onClick: startGithubLogin, children: _jsxs("span", { className: "flex items-center justify-between gap-3", children: [_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconLogin, { className: "h-4 w-4 text-textMuted" }), _jsx("span", { children: "Continue with GitHub" })] }), _jsx("span", { className: "text-textMuted", children: "\u2192" })] }) }), _jsx("button", { type: "button", disabled: !apiBase, className: "w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-muted hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50", onClick: startGoogleLogin, children: _jsxs("span", { className: "flex items-center justify-between gap-3", children: [_jsxs("span", { className: "inline-flex items-center gap-2", children: [_jsx(IconLogin, { className: "h-4 w-4 text-textMuted" }), _jsx("span", { children: "Continue with Google" })] }), _jsx("span", { className: "text-textMuted", children: "\u2192" })] }) })] })] })] }) }))] })] }) }), _jsx(HelpDrawer, { open: helpOpen, onClose: () => setHelpOpen(false) })] }));
}
