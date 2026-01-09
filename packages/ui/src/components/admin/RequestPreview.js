import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from "react";
import { Button } from "../ui/Button";
import { CodeBlock } from "../ui/CodeBlock";
import { Alert } from "../ui/Alert";
import { Switch } from "../ui/Switch";
import { Card } from "../ui/Card";
import { Accordion } from "../ui/Accordion";
export function RequestPreview({ body, warnings, errors, apiBase, adminToken, includeTokenInCurl = false, onIncludeTokenInCurlChange, sessionAuth = false, onCopyJson, onCopyCurl, collapsible = false, idPrefix = "request-preview" }) {
    const json = useMemo(() => JSON.stringify(body, null, 2), [body]);
    const curl = useMemo(() => {
        const payload = JSON.stringify(body);
        const base = apiBase.replace(/\/$/, "");
        if (sessionAuth) {
            return `curl -X POST '${base}/admin/exams' -H 'Content-Type: application/json' -b "<SESSION_COOKIE>" -d '${payload}'`;
        }
        const tokenPart = includeTokenInCurl ? adminToken || "<ADMIN_TOKEN>" : "<ADMIN_TOKEN>";
        return `curl -X POST '${base}/admin/exams' -H 'Authorization: Bearer ${tokenPart}' -H 'Content-Type: application/json' -d '${payload}'`;
    }, [apiBase, adminToken, body, includeTokenInCurl, sessionAuth]);
    const errorList = Object.values(errors);
    const switchId = `${idPrefix}-include-token`;
    const content = (_jsxs("div", { className: "space-y-3", children: [!collapsible ? (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-base font-semibold text-text", children: "Request Preview" }), sessionAuth ? (_jsx("div", { className: "text-xs text-textMuted", children: "Uses admin session cookie" })) : (_jsxs("div", { className: "flex items-center gap-2 text-xs text-textMuted", children: [_jsx(Switch, { id: switchId, checked: includeTokenInCurl, onChange: (value) => onIncludeTokenInCurlChange?.(value) }), _jsx("label", { htmlFor: switchId, children: "Include token in curl" })] }))] })) : sessionAuth ? (_jsx("div", { className: "text-xs text-textMuted", children: "Uses admin session cookie" })) : (_jsxs("div", { className: "flex items-center gap-2 text-xs text-textMuted", children: [_jsx(Switch, { id: switchId, checked: includeTokenInCurl, onChange: (value) => onIncludeTokenInCurlChange?.(value) }), _jsx("label", { htmlFor: switchId, children: "Include token in curl" })] })), errorList.length > 0 ? (_jsx(Alert, { tone: "error", children: errorList.map((err, idx) => (_jsx("div", { children: err }, `${err}-${idx}`))) })) : null, warnings.length > 0 ? (_jsx(Alert, { tone: "warn", children: warnings.map((warn, idx) => (_jsx("div", { children: warn }, `${warn}-${idx}`))) })) : null, _jsx(CodeBlock, { children: json }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { type: "button", variant: "secondary", onClick: () => onCopyJson(json), children: "Copy JSON" }), _jsx(Button, { type: "button", variant: "ghost", onClick: () => onCopyCurl(curl), children: "Copy curl" })] })] }));
    if (collapsible) {
        return (_jsx(Accordion, { title: "Request Preview", defaultOpen: false, children: content }));
    }
    return _jsx(Card, { className: "space-y-3", children: content });
}
