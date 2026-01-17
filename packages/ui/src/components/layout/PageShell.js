import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import { Footer } from "./Footer";
const maxWidthClass = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "6xl": "max-w-6xl"
};
export function PageShell({ children, maxWidth = "6xl", className }) {
    return (_jsxs("div", { className: "bg-bg min-h-screen flex flex-col", children: [_jsx("main", { className: clsx("mx-auto w-full px-3 sm:px-4 py-6 sm:py-8 flex-1", maxWidthClass[maxWidth], className), children: children }), _jsx(Footer, {})] }));
}
