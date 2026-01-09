import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
const toneClasses = {
    info: "border-info/30 bg-info/10 text-info",
    warn: "border-warn/30 bg-warn/10 text-warn",
    error: "border-error/30 bg-error/10 text-error",
    success: "border-success/30 bg-success/10 text-success"
};
export function Alert({ tone = "info", children, className }) {
    return (_jsx("div", { className: clsx("rounded-lg border px-3 py-2 text-sm", toneClasses[tone], className), role: tone === "error" ? "alert" : "status", "aria-live": "polite", children: children }));
}
