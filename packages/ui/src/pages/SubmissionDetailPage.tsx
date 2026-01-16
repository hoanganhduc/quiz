import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getSubmissionDetail, getExamBank, SubmissionDetail, ExamBankResponse } from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { McqQuestion } from "../components/McqQuestion";
import { FillBlankQuestion } from "../components/FillBlankQuestion";
import { formatDateTime } from "../utils/time";
import { AnswerValueV1 } from "@app/shared";

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

                // If sub doesn't have prompts, try to load the bank as fallback
                const firstPq = sub.perQuestion[0];
                if (sub.examId && (!firstPq || !firstPq.prompt)) {
                    try {
                        const bankData = await getExamBank(sub.examId);
                        setBank(bankData);
                    } catch (e) {
                        console.warn("Could not load bank fallback", e);
                    }
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
                {submission.perQuestion.map((pq, idx) => {
                    // Try to find full question from bank if available, otherwise reconstruct from enriched pq
                    const questionFromBank = bank?.questions.find(q => q.uid === pq.uid);

                    if (!pq.prompt && !questionFromBank) {
                        return (
                            <Card key={pq.uid} className="p-4 text-sm text-textMuted italic">
                                Question content not available ({pq.uid})
                            </Card>
                        );
                    }

                    const displayQuestion: any = questionFromBank || {
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
                        return (
                            <McqQuestion
                                key={pq.uid}
                                index={idx}
                                question={displayQuestion}
                                answer={pq.chosen as string}
                                onChange={() => { }} // Read-only
                                showSolution={true}
                                submissionStatus={pq.correct ? "correct" : "incorrect"}
                            />
                        );
                    } else if (displayQuestion.type === "fill-blank") {
                        return (
                            <FillBlankQuestion
                                key={pq.uid}
                                index={idx}
                                question={displayQuestion}
                                answer={pq.chosen as AnswerValueV1}
                                onChange={() => { }} // Read-only
                                showSolution={true}
                                submissionStatus={pq.correct ? "correct" : "incorrect"}
                            />
                        );
                    }
                    return null;
                })}
            </div>
        </PageShell>
    );
}
