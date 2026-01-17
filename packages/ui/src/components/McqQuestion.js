import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import clsx from "clsx";
import { LatexContent } from "./LatexContent";
export function McqQuestion({ index, question, answer, onChange, showSolution, submissionStatus }) {
    if (question.type !== "mcq-single") {
        return null;
    }
    const status = submissionStatus === "correct"
        ? "correct"
        : submissionStatus === "incorrect"
            ? "incorrect"
            : answer
                ? "answered"
                : "unanswered";
    const choices = question.choices;
    const keys = choices.map((c) => c.key);
    const [focused, setFocused] = useState(null);
    const optionRefs = useRef({});
    useEffect(() => {
        setFocused(answer ? answer : null);
    }, [answer]);
    const onSelect = useCallback((key) => {
        onChange(question.uid, key);
        setFocused(key);
    }, [onChange, question.uid]);
    const badgeTone = status === "correct" ? "success" : status === "incorrect" ? "error" : status === "answered" ? "info" : "warn";
    const badgeLabel = status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : status === "answered" ? "Answered" : "Unanswered";
    const handleKey = useCallback((e) => {
        const currentIndex = focused ? keys.indexOf(focused) : -1;
        const letter = e.key.toUpperCase();
        if (/^[A-E]$/.test(letter)) {
            if (keys.includes(letter)) {
                e.preventDefault();
                onSelect(letter);
            }
        }
        else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault();
            const next = currentIndex === -1 ? 0 : (currentIndex + 1) % keys.length;
            const key = keys[next];
            setFocused(key);
            optionRefs.current[key]?.focus();
        }
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault();
            const prev = currentIndex <= 0 ? keys.length - 1 : currentIndex - 1;
            const key = keys[prev];
            setFocused(key);
            optionRefs.current[key]?.focus();
        }
        else if (e.key === "Enter" || e.key === " ") {
            if (focused) {
                e.preventDefault();
                onSelect(focused);
            }
        }
    }, [focused, keys, onSelect]);
    const answeredChoice = useMemo(() => answer, [answer]);
    return (_jsxs(Card, { className: "space-y-3", padding: "md", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "text-xs text-slate-500", children: ["Question ", index + 1] }), _jsx("div", { className: "font-semibold text-base leading-relaxed", children: _jsx(LatexContent, { content: question.prompt }) })] }), _jsx(Badge, { tone: badgeTone, children: badgeLabel })] }), _jsx("div", { role: "radiogroup", "aria-label": `Choices for question ${index + 1}`, onKeyDown: handleKey, className: "space-y-2", children: choices.map((choice) => {
                    const active = answeredChoice === choice.key;
                    const isCorrect = "answerKey" in question && question.answerKey === choice.key;
                    const showAsCorrect = showSolution && isCorrect;
                    const showAsIncorrect = showSolution && active && !isCorrect;
                    return (_jsxs("button", { ref: (el) => (optionRefs.current[choice.key] = el), type: "button", onClick: () => onSelect(choice.key), className: clsx("w-full text-left rounded-lg border px-3 py-3 flex gap-3 items-start focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2 transition-colors", showAsCorrect
                            ? "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600"
                            : showAsIncorrect
                                ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100 dark:border-red-600"
                                : active
                                    ? "border-info bg-selectionBg text-selectionText"
                                    : "border-border bg-muted/60 hover:border-info/50 dark:bg-slate-900/70", "min-h-[44px]"), children: [_jsxs("span", { className: clsx("font-semibold text-sm w-6 text-center", (showAsCorrect || showAsIncorrect || active) ? "text-inherit" : "text-text"), children: [choice.key, "."] }), _jsx("span", { className: "text-sm leading-relaxed flex-1", children: _jsx(LatexContent, { inline: true, content: choice.text }) }), showAsCorrect && (_jsx("span", { className: "text-green-600 dark:text-green-400", children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z", clipRule: "evenodd" }) }) })), showAsIncorrect && (_jsx("span", { className: "text-red-600 dark:text-red-400", children: _jsx("svg", { xmlns: "http://www.w3.org/2000/svg", className: "h-5 w-5", viewBox: "0 0 20 20", fill: "currentColor", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z", clipRule: "evenodd" }) }) }))] }, choice.key));
                }) }), showSolution && "answerKey" in question && question.answerKey ? (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "cursor-pointer text-sm text-info font-medium", children: "View solution" }), _jsxs("div", { className: "prose-solution mt-2", children: [_jsx("div", { className: "text-xs font-semibold text-textMuted uppercase tracking-wide", children: "Solution" }), _jsxs("div", { className: "mt-2", children: [_jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "font-semibold", children: "Answer:" }), " ", question.answerKey] }), question.solution ? (_jsx("div", { className: "mt-2 text-sm leading-relaxed", children: _jsx(LatexContent, { content: question.solution }) })) : null] })] })] })) : null] }));
}
