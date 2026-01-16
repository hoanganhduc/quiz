import { jsx as _jsx } from "react/jsx-runtime";
import clsx from "clsx";
const maxWidthClass = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "6xl": "max-w-6xl"
};
export function PageShell({ children, maxWidth = "6xl", className }) {
    return (_jsx("div", { className: "bg-bg min-h-screen", children: _jsx("div", { className: clsx("mx-auto w-full px-3 sm:px-4 py-6 sm:py-8", maxWidthClass[maxWidth], className), children: children }) }));
}
