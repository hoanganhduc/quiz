import { jsx as _jsx } from "react/jsx-runtime";
import { Button } from "./Button";
import clsx from "clsx";
export function FloatingActionBar({ show, children }) {
    if (!show)
        return null;
    return (_jsx("div", { className: "fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur shadow-card lg:hidden", children: _jsx("div", { className: "mx-auto max-w-5xl px-4 py-3 flex flex-col gap-2", children: children }) }));
}
export function FloatingActionsRow({ children, className }) {
    return _jsx("div", { className: clsx("flex items-center gap-2 flex-wrap", className), children: children });
}
export function FloatingPrimaryButton({ disabled, onClick, children }) {
    return (_jsx(Button, { className: "flex-1", variant: "primary", onClick: onClick, disabled: disabled, children: children }));
}
