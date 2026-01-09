import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
function statusStyles(status) {
    switch (status) {
        case "done":
            return {
                dot: "bg-success text-white border-success",
                title: "text-text",
                desc: "text-textMuted"
            };
        case "current":
            return {
                dot: "bg-info text-white border-info",
                title: "text-text",
                desc: "text-textMuted"
            };
        case "optional":
            return {
                dot: "bg-muted text-text border-border",
                title: "text-text",
                desc: "text-textMuted"
            };
        case "todo":
        default:
            return {
                dot: "bg-card text-textMuted border-border",
                title: "text-textMuted",
                desc: "text-textMuted"
            };
    }
}
function Dot({ status, index }) {
    const s = statusStyles(status);
    return (_jsx("div", { className: clsx("flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold", s.dot), "aria-hidden": true, children: status === "done" ? "✓" : index + 1 }));
}
export function StepIndicator({ steps, className }) {
    return (_jsx("ol", { className: clsx("space-y-3", className), children: steps.map((step, idx) => {
            const s = statusStyles(step.status);
            return (_jsxs("li", { className: "flex items-start gap-3", children: [_jsxs("div", { className: "flex flex-col items-center", children: [_jsx(Dot, { status: step.status, index: idx }), idx < steps.length - 1 ? _jsx("div", { className: "mt-2 h-6 w-px bg-border", "aria-hidden": true }) : null] }), _jsxs("div", { className: "min-w-0 pt-0.5", children: [_jsxs("div", { className: clsx("text-sm font-semibold", s.title), children: [step.title, step.status === "optional" ? (_jsx("span", { className: "ml-2 text-xs font-medium text-textMuted", children: "(optional)" })) : null] }), step.description ? _jsx("div", { className: clsx("text-sm", s.desc), children: step.description }) : null] })] }, `${idx}-${step.title}`));
        }) }));
}
