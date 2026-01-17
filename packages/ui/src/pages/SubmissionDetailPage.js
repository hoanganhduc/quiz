import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSubmissionDetail, getExamBank } from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { McqQuestion } from "../components/McqQuestion";
import { FillBlankQuestion } from "../components/FillBlankQuestion";
import { formatDateTime } from "../utils/time";
export function SubmissionDetailPage() {
    const { submissionId } = useParams();
    const [submission, setSubmission] = useState(null);
    const [bank, setBank] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const load = async () => {
            if (!submissionId)
                return;
            setLoading(true);
            setError(null);
            try {
                const sub = await getSubmissionDetail(submissionId);
                setSubmission(sub);
                // If sub doesn't have prompts, try to load the bank as fallback
                const firstPq = sub.perQuestion[0];
                if (sub.examId && (!firstPq || !firstPq.prompt)) {
                    try {
                        const bankData = await getExamBank(sub.examId);
                        setBank(bankData);
                    }
                    catch (e) {
                        console.warn("Could not load bank fallback", e);
                    }
                }
            }
            catch (err) {
                setError(err?.message ?? "Failed to load submission details");
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [submissionId]);
    if (loading) {
        return _jsx(PageShell, { children: _jsx("div", { className: "p-6 text-center text-sm text-textMuted", children: "Loading details..." }) });
    }
    if (error || !submission) {
        return (_jsxs(PageShell, { children: [_jsx(Alert, { tone: "error", children: error ?? "Submission not found" }), _jsx("div", { className: "mt-4", children: _jsx(Link, { to: "/history", children: _jsx(Button, { variant: "secondary", children: "Back to History" }) }) })] }));
    }
    return (_jsxs(PageShell, { maxWidth: "4xl", className: "space-y-6", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-text", children: "Submission Details" }), _jsxs("p", { className: "text-sm text-textMuted", children: ["Submitted on ", formatDateTime(submission.submittedAt)] })] }), _jsx(Link, { to: "/history", children: _jsx(Button, { variant: "secondary", size: "sm", children: "Back to History" }) })] }), _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs(Card, { className: "space-y-2", children: [_jsx("div", { className: "text-xs uppercase font-bold text-textMuted tracking-wider", children: "Exam Information" }), _jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "font-semibold", children: "Exam ID:" }), " ", submission.examId] }), submission.version && (_jsxs("div", { className: "text-sm", children: [_jsx("span", { className: "font-semibold", children: "Version:" }), " ", submission.version.versionId, " (Index: ", submission.version.versionIndex, ")"] }))] }), _jsxs(Card, { className: "space-y-2 flex flex-col justify-center items-center", children: [_jsx("div", { className: "text-xs uppercase font-bold text-textMuted tracking-wider", children: "Score" }), _jsxs("div", { className: "text-4xl font-bold text-info", children: [submission.score.correct, " / ", submission.score.total] }), _jsxs(Badge, { tone: "success", children: [Math.round((submission.score.correct / submission.score.total) * 100), "% Correct"] })] })] }), _jsxs("div", { className: "space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold text-text", children: "Questions & Results" }), submission.perQuestion.map((pq, idx) => {
                        // Try to find full question from bank if available, otherwise reconstruct from enriched pq
                        const questionFromBank = bank?.questions.find(q => q.uid === pq.uid);
                        if (!pq.prompt && !questionFromBank) {
                            return (_jsxs(Card, { className: "p-4 text-sm text-textMuted italic", children: ["Question content not available (", pq.uid, ")"] }, pq.uid));
                        }
                        const displayQuestion = questionFromBank || {
                            uid: pq.uid,
                            prompt: pq.prompt,
                            choices: pq.choices,
                            answerKey: pq.answerKey,
                            answers: pq.expected,
                            solution: pq.solution,
                            type: pq.choices ? "mcq-single" : "fill-blank",
                            // Mock other fields for UI
                            id: pq.uid.split(":").pop() || pq.uid,
                            subject: "discrete-math",
                            topic: "General",
                            level: "basic",
                            number: idx + 1
                        };
                        if (displayQuestion.type === "mcq-single") {
                            return (_jsx(McqQuestion, { index: idx, question: displayQuestion, answer: pq.chosen, onChange: () => { }, showSolution: true, submissionStatus: pq.correct ? "correct" : "incorrect" }, pq.uid));
                        }
                        else if (displayQuestion.type === "fill-blank") {
                            return (_jsx(FillBlankQuestion, { index: idx, question: displayQuestion, answer: pq.chosen, onChange: () => { }, showSolution: true, submissionStatus: pq.correct ? "correct" : "incorrect" }, pq.uid));
                        }
                        return null;
                    })] })] }));
}
