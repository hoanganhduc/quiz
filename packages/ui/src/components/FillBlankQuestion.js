import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import clsx from "clsx";
import { LatexContent } from "./LatexContent";
export function FillBlankQuestion({ index, question, answer, onChange, showSolution, submissionStatus }) {
    if (question.type !== "fill-blank") {
        return null;
    }
    const status = submissionStatus === "correct"
        ? "correct"
        : submissionStatus === "incorrect"
            ? "incorrect"
            : answer
                ? "answered"
                : "unanswered";
    const [values, setValues] = useState([]);
    useEffect(() => {
        if (Array.isArray(answer))
            setValues(answer);
        else if (typeof answer === "string")
            setValues([answer]);
        else
            setValues([]);
    }, [answer]);
    const blankCount = question.blankCount;
    const onSet = useCallback((idx, val) => {
        const next = Array.from({ length: blankCount }, (_, i) => (i === idx ? val : values[i] ?? ""));
        setValues(next);
        onChange(question.uid, next);
    }, [blankCount, onChange, question.uid, values]);
    const badgeTone = status === "correct" ? "success" : status === "incorrect" ? "error" : status === "answered" ? "info" : "warn";
    const badgeLabel = status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : status === "answered" ? "Answered" : "Unanswered";
    const hasSolutions = showSolution && "answers" in question && Array.isArray(question.answers);
    const expected = useMemo(() => (hasSolutions ? question.answers : []), [hasSolutions, question]);
    return (_jsxs(Card, { className: "space-y-3", padding: "md", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "text-xs text-slate-500", children: ["Question ", index + 1] }), _jsx("div", { className: "font-semibold text-base leading-relaxed", children: _jsx(LatexContent, { content: question.prompt }) })] }), _jsx(Badge, { tone: badgeTone, children: badgeLabel })] }), _jsx("div", { className: "space-y-2", children: Array.from({ length: blankCount }, (_, i) => (_jsxs("label", { className: "block", children: [_jsxs("div", { className: "text-xs text-textMuted mb-1", children: ["Blank ", i + 1] }), _jsx("input", { className: clsx("w-full rounded-lg border px-3 py-2 text-sm", "border-border focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"), value: values[i] ?? "", onChange: (e) => onSet(i, e.target.value), placeholder: "Enter answer" })] }, i))) }), hasSolutions ? (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "cursor-pointer text-sm text-info font-medium", children: "View solution" }), _jsxs("div", { className: "prose-solution mt-2", children: [_jsx("div", { className: "text-xs font-semibold text-textMuted uppercase tracking-wide", children: "Solution" }), _jsxs("div", { className: "mt-2", children: [_jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "font-semibold", children: "Expected:" }), " ", expected.join(", ")] }), "solution" in question && question.solution ? (_jsx("div", { className: "mt-2 text-sm leading-relaxed", children: _jsx(LatexContent, { content: question.solution }) })) : null] })] })] })) : null] }));
}
