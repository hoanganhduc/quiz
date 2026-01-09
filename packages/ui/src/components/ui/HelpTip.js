import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
export function HelpTip({ text, className, buttonLabel = "Help" }) {
    const [open, setOpen] = useState(false);
    const id = useId();
    const rootRef = useRef(null);
    const btnRef = useRef(null);
    useEffect(() => {
        if (!open)
            return;
        const onKeyDown = (e) => {
            if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                btnRef.current?.focus();
            }
        };
        const onPointerDown = (e) => {
            if (!rootRef.current)
                return;
            if (!rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("pointerdown", onPointerDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("pointerdown", onPointerDown);
        };
    }, [open]);
    return (_jsxs("span", { ref: rootRef, className: clsx("relative inline-flex", className), children: [_jsx("button", { ref: btnRef, type: "button", className: clsx("inline-flex h-6 w-6 items-center justify-center rounded-full", "border border-border bg-card text-textMuted hover:bg-muted", "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"), "aria-label": buttonLabel, "aria-expanded": open, "aria-controls": `${id}-panel`, onClick: () => setOpen((v) => !v), children: "i" }), open ? (_jsx("span", { id: `${id}-panel`, role: "tooltip", className: clsx("absolute right-0 top-full mt-2 w-[260px] max-w-[80vw]", "rounded-lg border border-border bg-card p-3 text-sm text-text shadow-card"), children: text })) : null] }));
}
