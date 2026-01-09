import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card } from "../ui/Card";
import { Switch } from "../ui/Switch";
import { Input } from "../ui/Input";
export function SeedCard({ autoSeed, seed, onAutoSeedChange, onSeedChange, error }) {
    return (_jsxs(Card, { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-base font-semibold text-text", children: "Seed" }), _jsx("p", { className: "text-xs text-textMuted", children: "Same seed + same bank = deterministic ordering." })] }), _jsxs("div", { className: "flex items-center gap-2 text-sm text-textMuted", children: [_jsx(Switch, { id: "auto-seed", checked: autoSeed, onChange: onAutoSeedChange }), _jsx("label", { htmlFor: "auto-seed", children: "Auto-generate" })] })] }), !autoSeed ? (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-text", htmlFor: "seed", children: "Seed value" }), _jsx(Input, { id: "seed", value: seed, onChange: (e) => onSeedChange(e.target.value), placeholder: "exam-seed-123", hasError: Boolean(error), "aria-describedby": error ? "seed-error" : undefined }), error ? (_jsx("p", { className: "text-xs text-error", role: "alert", id: "seed-error", children: error })) : null] })) : null] }));
}
