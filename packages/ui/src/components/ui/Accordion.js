import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import clsx from "clsx";
import { Button } from "./Button";
const toneBorder = {
    info: "border-info/30",
    warn: "border-warn/30",
    error: "border-error/30",
    success: "border-success/30",
    muted: "border-border"
};
export function Accordion({ title, children, defaultOpen = false, tone = "muted" }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsxs("div", { className: clsx("rounded-xl border bg-card shadow-sm", toneBorder[tone]), children: [_jsxs("div", { className: "flex items-center justify-between px-4 py-3", children: [_jsx("h3", { className: "font-medium text-sm", children: title }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setOpen((o) => !o), children: open ? "Hide" : "Show" })] }), open ? _jsx("div", { className: "px-4 pb-4 text-sm space-y-3", children: children }) : null] }));
}
