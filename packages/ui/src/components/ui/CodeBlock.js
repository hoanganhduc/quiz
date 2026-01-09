import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
export function CodeBlock({ children, className }) {
    return (_jsx("pre", { className: clsx("overflow-auto rounded-lg border border-border bg-slate-950/90 p-3 text-xs text-slate-100", className), children: _jsx("code", { children: children }) }));
}
