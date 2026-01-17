import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { formatDateTime } from "../utils/time";
export function ExamListItem({ exam, actions, onCheck, checked, onLinkClick }) {
    const formatDate = (value) => {
        if (!value)
            return "—";
        return formatDateTime(value);
    };
    const displayName = exam.title ? exam.title : exam.examId;
    return (_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 bg-card shadow-sm hover:shadow-md transition-shadow", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-4", children: [onCheck && (_jsx("div", { className: "pt-1", children: _jsx("input", { type: "checkbox", className: "h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500", checked: Boolean(checked), onChange: (e) => onCheck(e.target.checked), "aria-label": `Select ${exam.examId}` }) })), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-0.5", children: [onLinkClick ? (_jsx("a", { href: "#", onClick: (e) => {
                                            e.preventDefault();
                                            onLinkClick();
                                        }, className: "text-sm font-semibold text-indigo-600 hover:text-indigo-500 hover:underline text-left truncate max-w-[15rem] sm:max-w-md cursor-pointer", children: displayName })) : (_jsx("span", { className: "text-sm font-medium text-text truncate max-w-[15rem] sm:max-w-md cursor-default", children: displayName })), exam.visibility && (_jsx(Badge, { tone: exam.visibility === "public" ? "info" : "muted", children: exam.visibility === "public" ? "Public" : "Private" })), exam.deletedAt ? _jsx(Badge, { tone: "warn", children: "Deleted" }) : null, exam.hasSubmissions ? _jsx(Badge, { tone: "info", children: "Taken" }) : null] }), _jsxs("div", { className: "text-xs text-textMuted flex flex-wrap gap-x-2 gap-y-1", children: [exam.title && (_jsxs("span", { className: "font-mono bg-muted px-1 rounded text-[10px] uppercase tracking-wider", children: ["ID: ", exam.examId] })), _jsxs("span", { children: ["Created ", formatDate(exam.createdAt)] }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: ["Expires ", formatDate(exam.expiresAt)] })] })] })] }), _jsx("div", { className: "flex flex-wrap items-center gap-2", children: actions?.map((action, idx) => (_jsx(Button, { type: "button", size: "sm", variant: action.variant ?? "secondary", onClick: action.onClick, disabled: action.loading, children: action.loading ? "..." : action.label }, idx))) })] }));
}
