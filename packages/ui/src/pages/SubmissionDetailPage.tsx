import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSubmissionDetail, getExamBank, SubmissionDetail, ExamBankResponse } from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { McqQuestion } from "../components/McqQuestion";
import { formatDateTime } from "../utils/time";

export function SubmissionDetailPage() {
    const { submissionId } = useParams<{ submissionId: string }>();
    const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
    const [bank, setBank] = useState<ExamBankResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            if (!submissionId) return;
            setLoading(true);
            setError(null);
            try {
                const sub = await getSubmissionDetail(submissionId);
                setSubmission(sub);

                // Try to load the bank if we have an examId
                if (sub.examId) {
                    const bankData = await getExamBank(sub.examId);
                    setBank(bankData);
                }
            } catch (err: any) {
                setError(err?.message ?? "Failed to load submission details");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [submissionId]);

    if (loading) {
        return <PageShell><div className="p-6 text-center text-sm text-textMuted">Loading details...</div></PageShell>;
    }

    if (error || !submission) {
        return (
            <PageShell>
                <Alert tone="error">{error ?? "Submission not found"}</Alert>
                <div className="mt-4">
                    <Link to="/history">
                        <Button variant="secondary">Back to History</Button>
                    </Link>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell maxWidth="4xl" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text">Submission Details</h1>
                    <p className="text-sm text-textMuted">
                        Submitted on {formatDateTime(submission.submittedAt)}
                    </p>
                </div>
                <Link to="/history">
                    <Button variant="secondary" size="sm">Back to History</Button>
                </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="space-y-2">
                    <div className="text-xs uppercase font-bold text-textMuted tracking-wider">Exam Information</div>
                    <div className="text-sm">
                        <span className="font-semibold">Exam ID:</span> {submission.examId}
                    </div>
                    {submission.version && (
                        <div className="text-sm">
                            <span className="font-semibold">Version:</span> {submission.version.versionId} (Index: {submission.version.versionIndex})
                        </div>
                    )}
                </Card>
                <Card className="space-y-2 flex flex-col justify-center items-center">
                    <div className="text-xs uppercase font-bold text-textMuted tracking-wider">Score</div>
                    <div className="text-4xl font-bold text-info">
                        {submission.score.correct} / {submission.score.total}
                    </div>
                    <Badge tone="success">
                        {Math.round((submission.score.correct / submission.score.total) * 100)}% Correct
                    </Badge>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-text">Questions & Results</h2>
                {bank ? (
                    bank.questions.map((q, idx) => {
                        const result = submission.perQuestion.find((p) => p.uid === q.uid);
                        return (
                            <McqQuestion
                                key={q.uid}
                                index={idx}
                                question={q}
                                answer={result?.chosen as string}
                                onChange={() => { }} // Read-only
                                showSolution={true}
                                submissionStatus={result?.correct ? "correct" : "incorrect"}
                            />
                        );
                    })
                ) : (
                    <div className="space-y-4">
                        {submission.perQuestion.map((p, idx) => (
                            <Card key={p.uid} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold text-sm text-text">Question {idx + 1}</div>
                                    <Badge tone={p.correct ? "success" : "error"}>
                                        {p.correct ? "Correct" : "Incorrect"}
                                    </Badge>
                                </div>
                                <div className="text-sm">
                                    <span className="font-semibold">Your choice:</span> {p.chosen || "Unanswered"}
                                </div>
                                {p.answerKey && (
                                    <div className="text-sm text-success">
                                        <span className="font-semibold">Correct answer:</span> {p.answerKey}
                                    </div>
                                )}
                                {p.solution && (
                                    <div className="mt-2 text-sm text-textMuted italic border-l-2 border-border pl-3">
                                        {p.solution}
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </PageShell>
    );
}
