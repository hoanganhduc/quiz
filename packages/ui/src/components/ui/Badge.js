import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
const toneClasses = {
    info: "bg-info/10 text-info border-info/30",
    warn: "bg-warn/10 text-warn border-warn/30",
    error: "bg-error/10 text-error border-error/30",
    success: "bg-success/10 text-success border-success/30",
    muted: "bg-muted text-text border-border"
};
export function Badge({ tone = "muted", children, className }) {
    return (_jsx("span", { className: clsx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", toneClasses[tone], className), children: children }));
}
