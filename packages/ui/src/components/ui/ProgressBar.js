import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
export function ProgressBar({ value, className }) {
    const pct = Math.min(100, Math.max(0, value));
    return (_jsx("div", { className: clsx("w-full rounded-full bg-muted h-2", className), "aria-label": "Completion progress", children: _jsx("div", { className: "h-2 rounded-full bg-info transition-all", style: { width: `${pct}%` } }) }));
}
