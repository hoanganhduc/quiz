import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import clsx from "clsx";
import { PageShell } from "../components/layout/PageShell";
import { useTheme } from "../theme/useTheme";
import { AdminAuthGate } from "../components/admin/AdminAuthGate";
import { getR2Usage } from "../api/sourcesAdmin";
export function SettingsPage() {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const Option = ({ value, label }) => {
        const active = theme === value;
        return (_jsx(Button, { type: "button", size: "sm", variant: active ? "primary" : "secondary", onClick: () => setTheme(value), className: clsx("min-w-[90px]", active ? "" : "hover:bg-muted/70"), "aria-pressed": active, children: label }));
    };
    return (_jsxs(PageShell, { maxWidth: "3xl", className: "space-y-4", children: [_jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold text-text", children: "Appearance" }), _jsx("p", { className: "text-sm text-textMuted", children: "Choose how the UI looks on this device." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-medium text-text", children: "Theme" }), _jsxs("div", { role: "radiogroup", "aria-label": "Theme", className: "flex flex-wrap gap-2", children: [_jsx(Option, { value: "light", label: "Light" }), _jsx(Option, { value: "dark", label: "Dark" }), _jsx(Option, { value: "system", label: "System" })] }), _jsxs("div", { className: "text-xs text-textMuted", children: ["Current: ", resolvedTheme] })] })] }), _jsx(AdminAuthGate, { children: _jsx(UploadUsageCard, {}) })] }));
}
function UploadUsageCard() {
    const [r2Usage, setR2Usage] = useState(null);
    const [r2Notice, setR2Notice] = useState(null);
    const refreshR2Usage = async (showCleanupNotice = false) => {
        try {
            const res = await getR2Usage();
            setR2Usage(res);
            setR2Notice(null);
            if (showCleanupNotice && res.deleted > 0) {
                setR2Notice({ tone: "info", text: `Cleaned up ${res.deleted} expired uploads.` });
            }
        }
        catch (err) {
            setR2Notice({ tone: "warn", text: err?.message ?? "Failed to load R2 usage" });
        }
    };
    useEffect(() => {
        void refreshR2Usage();
    }, []);
    return (_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Upload" }), _jsx("p", { className: "text-sm text-textMuted", children: "Tracks usage and recent admin uploads." })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", size: "sm", variant: "secondary", onClick: () => refreshR2Usage(false), children: "Refresh" }), _jsx(Button, { type: "button", size: "sm", variant: "primary", onClick: () => refreshR2Usage(true), children: "Cleanup expired" })] })] }), r2Notice ? _jsx(Alert, { tone: r2Notice.tone, children: r2Notice.text }) : null, r2Usage?.warnings?.length ? (_jsx(Alert, { tone: "warn", children: r2Usage.warnings.map((warning) => (_jsx("div", { children: warning }, warning))) })) : null, _jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [_jsxs("div", { className: "rounded-lg border border-border bg-card p-3", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Stored" }), _jsx("div", { className: "text-sm font-semibold text-text", children: formatBytes(r2Usage?.usage?.bytesStored ?? 0) })] }), _jsxs("div", { className: "rounded-lg border border-border bg-card p-3", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Class A ops" }), _jsx("div", { className: "text-sm font-semibold text-text", children: r2Usage?.usage?.classA ?? 0 })] }), _jsxs("div", { className: "rounded-lg border border-border bg-card p-3", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Class B ops" }), _jsx("div", { className: "text-sm font-semibold text-text", children: r2Usage?.usage?.classB ?? 0 })] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-lg border border-border bg-card p-3", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Uploaded" }), _jsx("div", { className: "text-sm font-semibold text-text", children: formatBytes(r2Usage?.usage?.bytesUploaded ?? 0) })] }), _jsxs("div", { className: "rounded-lg border border-border bg-card p-3", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Downloaded" }), _jsx("div", { className: "text-sm font-semibold text-text", children: formatBytes(r2Usage?.usage?.bytesDownloaded ?? 0) })] })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-lg border border-border bg-card p-3", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Upload limit" }), _jsx("div", { className: "text-sm font-semibold text-text", children: formatBytes(r2Usage?.maxUploadBytes ?? 0) })] }), _jsxs("div", { className: "rounded-lg border border-border bg-card p-3", children: [_jsx("div", { className: "text-xs text-textMuted", children: "Auto-delete TTL" }), _jsxs("div", { className: "text-sm font-semibold text-text", children: [r2Usage?.uploadTtlHours ?? 0, " hours"] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "text-sm font-semibold text-text", children: "Recent uploads" }), r2Usage?.uploads?.length ? (_jsx("div", { className: "space-y-2 text-xs", children: r2Usage.uploads.map((upload) => (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-textMuted", children: formatUpdatedAt(upload.at) }), _jsx("div", { className: "font-mono text-xs truncate", children: upload.key })] }), _jsxs("div", { className: "flex items-center gap-2 text-textMuted", children: [_jsx("span", { children: upload.scope }), _jsx("span", { children: formatBytes(upload.bytes) })] })] }, `${upload.key}-${upload.at}`))) })) : (_jsx("div", { className: "text-xs text-textMuted", children: "No uploads logged yet." }))] })] }));
}
function formatBytes(bytes) {
    if (!Number.isFinite(bytes))
        return "-";
    const units = ["B", "KB", "MB", "GB"];
    let idx = 0;
    let val = bytes;
    while (val >= 1024 && idx < units.length - 1) {
        val /= 1024;
        idx += 1;
    }
    return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}
function formatUpdatedAt(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}
