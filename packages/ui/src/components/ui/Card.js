import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
export function Card({ children, className, padding = "md" }) {
    const pad = padding === "none" ? "" : padding === "sm" ? "p-3" : "p-4";
    return _jsx("div", { className: clsx("rounded-xl bg-card shadow-card border border-border", pad, className), children: children });
}
