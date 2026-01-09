import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import { Button } from "./Button";
export function EmptyState({ icon, title, description, primaryAction, secondaryAction, className }) {
    return (_jsxs("div", { className: clsx("rounded-xl border border-border bg-card p-6 text-center", "flex flex-col items-center gap-2", className), children: [icon ? _jsx("div", { className: "text-textMuted", children: icon }) : null, _jsx("div", { className: "text-base font-semibold text-text", children: title }), _jsx("div", { className: "text-sm text-textMuted max-w-md", children: description }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center justify-center gap-2", children: [_jsx(Button, { onClick: primaryAction.onClick, children: primaryAction.label }), secondaryAction ? (_jsx(Button, { variant: "secondary", onClick: secondaryAction.onClick, children: secondaryAction.label })) : null] })] }));
}
