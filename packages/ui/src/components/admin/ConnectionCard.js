import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Switch";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
const statusTone = {
    idle: "muted",
    checking: "info",
    connected: "success",
    error: "error"
};
const statusLabel = {
    idle: "Not tested",
    checking: "Checking",
    connected: "Connected",
    error: "Not connected"
};
export function ConnectionCard({ apiBase, onApiBaseChange, adminToken, onAdminTokenChange, tokenError, rememberToken, onRememberTokenChange, showToken, onToggleShowToken, hideAdminToken = false, hideTestButton = false, onTestConnection, status, statusMessage, lastError }) {
    return (_jsxs(Card, { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Connection" }), _jsx("p", { className: "text-sm text-textMuted", children: "Admin access to the Worker API." })] }), _jsx(Badge, { tone: statusTone[status], children: statusLabel[status] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "api-base", children: "API Base URL" }), _jsx(Input, { id: "api-base", value: apiBase, onChange: (e) => onApiBaseChange(e.target.value), placeholder: "https://your-worker.example.com" }), _jsx("p", { className: "text-xs text-textMuted", children: "Stored only for this browser session." })] }), hideAdminToken ? null : (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "admin-token", children: "Admin token" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "admin-token", type: showToken ? "text" : "password", value: adminToken ?? "", onChange: (e) => onAdminTokenChange?.(e.target.value), placeholder: "ADMIN_TOKEN", hasError: Boolean(tokenError), "aria-describedby": tokenError ? "admin-token-error" : undefined }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => onToggleShowToken?.(), children: showToken ? "Hide" : "Show" })] }), _jsxs("div", { className: "flex items-center gap-3 text-sm text-textMuted", children: [_jsx(Switch, { id: "remember-token", checked: Boolean(rememberToken), onChange: (value) => onRememberTokenChange?.(value) }), _jsx("label", { htmlFor: "remember-token", children: "Remember for this session" })] }), _jsx(Alert, { tone: "warn", children: "ADMIN_TOKEN grants exam creation authority. Avoid saving it on shared machines." }), tokenError ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: "admin-token-error", children: tokenError })) : null] })), hideTestButton ? (statusMessage ? _jsx("div", { className: "text-sm text-textMuted", children: statusMessage }) : null) : (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: onTestConnection, children: "Test Connection" }), statusMessage ? _jsx("span", { className: "text-sm text-textMuted", children: statusMessage }) : null] })), lastError ? (_jsx(Alert, { tone: "error", children: lastError })) : null] }));
}
