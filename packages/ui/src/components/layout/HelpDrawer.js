import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo } from "react";
import clsx from "clsx";
import { Button } from "../ui/Button";
function buildDocUrl(docPath, override) {
    if (override)
        return override;
    const repoUrl = import.meta.env.VITE_REPO_URL?.trim();
    if (repoUrl) {
        const base = repoUrl.replace(/\/$/, "");
        return `${base}/blob/main/${docPath}`;
    }
    // Fallback: repo-relative path (may only work in some deployments).
    return `/${docPath}`;
}
export function HelpDrawer({ open, onClose }) {
    const links = useMemo(() => {
        return {
            userGuide: buildDocUrl("docs/user-guide.md", import.meta.env.VITE_DOCS_USER_GUIDE_URL?.trim()),
            sourceAdmin: buildDocUrl("docs/source-admin.md", import.meta.env.VITE_DOCS_SOURCE_ADMIN_URL?.trim())
        };
    }, []);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (e) => {
            if (e.key === "Escape")
                onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);
    if (!open)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50", role: "dialog", "aria-modal": "true", "aria-label": "Help", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: onClose }), _jsxs("div", { className: clsx("absolute right-0 top-0 h-full w-full max-w-md", "bg-card border-l border-border shadow-card", "p-4 overflow-auto"), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Help" }), _jsx("p", { className: "text-sm text-textMuted", children: "Guides and answers to common questions." })] }), _jsx(Button, { type: "button", variant: "ghost", onClick: onClose, children: "Close" })] }), _jsxs("div", { className: "mt-4 space-y-3", children: [_jsxs("div", { className: "rounded-xl border border-border bg-muted p-3", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "Guides" }), _jsxs("ul", { className: "mt-2 space-y-2 text-sm", children: [_jsxs("li", { children: [_jsx("a", { className: "text-info hover:underline", href: links.userGuide, target: "_blank", rel: "noreferrer", children: "Student guide" }), _jsx("div", { className: "text-xs text-textMuted", children: "docs/user-guide.md" })] }), _jsxs("li", { children: [_jsx("a", { className: "text-info hover:underline", href: links.sourceAdmin, target: "_blank", rel: "noreferrer", children: "Admin sources guide" }), _jsx("div", { className: "text-xs text-textMuted", children: "docs/source-admin.md" })] })] }), _jsxs("div", { className: "mt-3 text-xs text-textMuted", children: ["If these links don\u2019t work in your deployment, set ", _jsx("span", { className: "font-mono", children: "VITE_DOCS_USER_GUIDE_URL" }), ",", _jsx("span", { className: "font-mono", children: " VITE_DOCS_SOURCE_ADMIN_URL" }), ", or ", _jsx("span", { className: "font-mono", children: "VITE_REPO_URL" }), "."] })] }), _jsxs("div", { className: "rounded-xl border border-border bg-card p-3", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "Common questions" }), _jsxs("div", { className: "mt-2 space-y-2", children: [_jsxs("details", { className: "rounded-lg border border-border bg-muted px-3 py-2", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium text-text", children: "What is view code?" }), _jsxs("div", { className: "mt-2 text-sm text-textMuted", children: ["A ", _jsx("strong", { children: "view code" }), " lets you open an exam in a view-only mode. You can read questions and interact with the UI, but you typically can\u2019t submit for a score."] })] }), _jsxs("details", { className: "rounded-lg border border-border bg-muted px-3 py-2", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium text-text", children: "When do solutions show?" }), _jsx("div", { className: "mt-2 text-sm text-textMuted", children: "It depends on how the exam was configured. Some exams show solutions after you submit; others hide solutions until the exam window ends." })] }), _jsxs("details", { className: "rounded-lg border border-border bg-muted px-3 py-2", children: [_jsx("summary", { className: "cursor-pointer text-sm font-medium text-text", children: "Why sign in?" }), _jsxs("div", { className: "mt-2 text-sm text-textMuted", children: ["Signing in links your attempt to your account so you can revisit results in ", _jsx("strong", { children: "My History" }), ". Some exams also require sign-in before you can start."] })] })] })] })] })] })] }));
}
