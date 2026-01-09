import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { Switch } from "../ui/Switch";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { Accordion } from "../ui/Accordion";
function normalizeCodes(codes) {
    const trimmed = codes.map((code) => code.trim()).filter(Boolean);
    return Array.from(new Set(trimmed));
}
function randomCode(length) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint32Array(length);
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
        crypto.getRandomValues(values);
    }
    else {
        for (let i = 0; i < length; i += 1)
            values[i] = Math.floor(Math.random() * alphabet.length);
    }
    return Array.from(values)
        .map((v) => alphabet[v % alphabet.length])
        .join("");
}
export function CodesEditor({ codesEnabled, codes, policy, onCodesEnabledChange, onCodesChange }) {
    const [bulkInput, setBulkInput] = useState("");
    const [singleCode, setSingleCode] = useState("");
    const [generateCount, setGenerateCount] = useState(5);
    const normalizedCodes = useMemo(() => normalizeCodes(codes), [codes]);
    const showWarning = (policy.requireViewCode || policy.requireSubmitCode) && normalizedCodes.length === 0;
    const addCodes = (incoming) => {
        onCodesChange(normalizeCodes([...normalizedCodes, ...incoming]));
    };
    const removeCode = (code) => {
        onCodesChange(normalizeCodes(normalizedCodes.filter((c) => c !== code)));
    };
    const onBulkAdd = () => {
        if (!bulkInput.trim())
            return;
        addCodes(bulkInput.split(/\r?\n/));
        setBulkInput("");
    };
    const onSingleAdd = () => {
        if (!singleCode.trim())
            return;
        addCodes([singleCode]);
        setSingleCode("");
    };
    const onGenerate = () => {
        const count = Math.max(1, Math.min(200, Math.floor(generateCount)));
        const generated = Array.from({ length: count }, () => randomCode(10));
        addCodes(generated);
    };
    return (_jsx(Accordion, { title: "Access Codes", defaultOpen: false, tone: showWarning ? "warn" : "muted", children: _jsxs(Card, { className: "space-y-4", padding: "sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-base font-semibold text-text", children: "Access codes" }), _jsx("p", { className: "text-xs text-textMuted", children: "Codes are case-sensitive and never leave your browser." })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-textMuted", children: [_jsx(Switch, { id: "codes-enabled", checked: codesEnabled, onChange: onCodesEnabledChange }), _jsx("label", { htmlFor: "codes-enabled", children: "Use access codes" })] })] }), showWarning ? (_jsx(Alert, { tone: "warn", children: "Policy requires access codes, but the list is empty. Students will not be blocked." })) : null, _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "bulk-codes", children: "Bulk add codes (one per line)" }), _jsx(Textarea, { id: "bulk-codes", value: bulkInput, onChange: (e) => setBulkInput(e.target.value), placeholder: "MATH3500-01\\nMATH3500-02", rows: 4, disabled: !codesEnabled }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: onBulkAdd, disabled: !codesEnabled, children: "Add codes" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "single-code", children: "Add a single code" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { id: "single-code", value: singleCode, onChange: (e) => setSingleCode(e.target.value), placeholder: "EXAM-ACCESS", disabled: !codesEnabled }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: onSingleAdd, disabled: !codesEnabled, children: "Add" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "generate-count", children: "Generate random codes" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(Input, { id: "generate-count", type: "number", min: 1, max: 200, value: generateCount, onChange: (e) => setGenerateCount(Number(e.target.value)), className: "w-24", disabled: !codesEnabled }), _jsx(Button, { type: "button", variant: "secondary", size: "sm", onClick: onGenerate, disabled: !codesEnabled, children: "Generate (length 10)" })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium text-text", children: "Codes list" }), normalizedCodes.length === 0 ? (_jsx("p", { className: "text-xs text-textMuted", children: "No codes added yet." })) : (_jsx("div", { className: "flex flex-wrap gap-2", children: normalizedCodes.map((code) => (_jsxs(Badge, { tone: "info", className: "gap-2", children: [code, _jsx("button", { type: "button", onClick: () => removeCode(code), className: "text-xs text-textMuted hover:text-text", "aria-label": `Remove code ${code}`, disabled: !codesEnabled, children: "\u2715" })] }, code))) }))] })] }) }));
}
