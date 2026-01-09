import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";
export function AdminUsersPage() {
    const apiBase = import.meta.env.VITE_API_BASE;
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const runSearch = async () => {
        if (!apiBase) {
            setStatus({ tone: "error", text: "API base not configured" });
            return;
        }
        const trimmed = query.trim();
        if (!trimmed) {
            setResults([]);
            return;
        }
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch(`${apiBase}/admin/users/search?q=${encodeURIComponent(trimmed)}`, {
                credentials: "include"
            });
            if (!res.ok)
                throw new Error(await res.text());
            const data = (await res.json());
            setResults(data.users ?? []);
        }
        catch (err) {
            setStatus({ tone: "error", text: err?.message ?? "Search failed" });
        }
        finally {
            setLoading(false);
        }
    };
    const updateRole = async (appUserId, makeAdmin) => {
        if (!apiBase) {
            setStatus({ tone: "error", text: "API base not configured" });
            return;
        }
        setStatus(null);
        try {
            const res = await fetch(`${apiBase}/admin/users/${appUserId}/roles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ makeAdmin })
            });
            if (!res.ok)
                throw new Error(await res.text());
            const data = (await res.json());
            setResults((prev) => prev.map((item) => (item.appUserId === appUserId ? data.user : item)));
            setStatus({ tone: "success", text: makeAdmin ? "User promoted" : "User demoted" });
        }
        catch (err) {
            setStatus({ tone: "error", text: err?.message ?? "Update failed" });
        }
    };
    return (_jsx(AdminAuthGate, { children: _jsxs(PageShell, { maxWidth: "4xl", className: "space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold text-text", children: "Admin Users" }), _jsx("p", { className: "text-sm text-textMuted", children: "Search and manage admin roles." })] }), _jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap gap-2 items-end", children: [_jsxs("div", { className: "flex-1 min-w-[220px]", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "user-search", children: "Search users" }), _jsx(Input, { id: "user-search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "appUserId, GitHub username, or Google email" })] }), _jsx(Button, { onClick: runSearch, disabled: loading, children: loading ? "Searching..." : "Search" })] }), status ? _jsx(Alert, { tone: status.tone, children: status.text }) : null] }), _jsx("div", { className: "space-y-3", children: results.length === 0 ? (_jsx(Card, { children: _jsx("p", { className: "text-sm text-textMuted", children: "No results." }) })) : (results.map((user) => {
                        const isAdmin = user.roles.includes("admin");
                        return (_jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-text", children: user.displayName ?? "(No name)" }), _jsx("div", { className: "text-xs text-textMuted font-mono break-all", children: user.appUserId })] }), _jsx(Badge, { tone: isAdmin ? "success" : "muted", children: isAdmin ? "Admin" : "User" })] }), _jsxs("div", { className: "grid gap-2 text-sm text-textMuted", children: [_jsxs("div", { children: ["GitHub: ", user.githubUsername ?? "—"] }), _jsxs("div", { children: ["Google: ", user.googleEmail ?? "—"] })] }), _jsx("div", { className: "flex gap-2", children: isAdmin ? (_jsx(Button, { variant: "secondary", onClick: () => updateRole(user.appUserId, false), children: "Demote" })) : (_jsx(Button, { onClick: () => updateRole(user.appUserId, true), children: "Promote to admin" })) })] }, user.appUserId));
                    })) })] }) }));
}
