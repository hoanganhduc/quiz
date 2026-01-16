import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { formatDateTime } from "../utils/time";

export type ExamListItemProps = {
    exam: {
        examId: string;
        subject: string;
        title?: string;
        createdAt: string;
        expiresAt: string | null;
        visibility?: "public" | "private";
        deletedAt?: string | null;
        hasSubmissions?: boolean;
    };
    actions?: Array<{
        label: string;
        onClick: () => void;
        variant?: "primary" | "secondary" | "ghost" | "danger";
        loading?: boolean;
    }>;
    onCheck?: (checked: boolean) => void;
    checked?: boolean;
    onLinkClick?: () => void;
};

export function ExamListItem({ exam, actions, onCheck, checked, onLinkClick }: ExamListItemProps) {
    const formatDate = (value: string | null | undefined) => {
        if (!value) return "—";
        return formatDateTime(value);
    };

    const displayName = exam.title ? exam.title : `Exam ${exam.examId}`;

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 bg-card shadow-sm hover:shadow-md transition-shadow">
            <div className="flex min-w-0 items-start gap-4">
                {onCheck && (
                    <div className="pt-1">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                            checked={Boolean(checked)}
                            onChange={(e) => onCheck(e.target.checked)}
                            aria-label={`Select ${exam.examId}`}
                        />
                    </div>
                )}
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <button
                            onClick={onLinkClick}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 hover:underline text-left truncate max-w-[15rem] sm:max-w-md"
                        >
                            {displayName}
                        </button>
                        {exam.visibility && (
                            <Badge tone={exam.visibility === "public" ? "info" : "muted"}>
                                {exam.visibility === "public" ? "Public" : "Private"}
                            </Badge>
                        )}
                        {exam.deletedAt ? <Badge tone="warn">Deleted</Badge> : null}
                        {exam.hasSubmissions ? <Badge tone="info">Taken</Badge> : null}
                    </div>
                    <div className="text-xs text-textMuted flex flex-wrap gap-x-2 gap-y-1">
                        {exam.title && (
                            <span className="font-mono bg-muted px-1 rounded text-[10px] uppercase tracking-wider">
                                ID: {exam.examId}
                            </span>
                        )}
                        <span>Created {formatDate(exam.createdAt)}</span>
                        <span>·</span>
                        <span>Expires {formatDate(exam.expiresAt)}</span>
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {actions?.map((action, idx) => (
                    <Button
                        key={idx}
                        type="button"
                        size="sm"
                        variant={action.variant ?? "secondary"}
                        onClick={action.onClick}
                        disabled={action.loading}
                    >
                        {action.loading ? "..." : action.label}
                    </Button>
                ))}
            </div>
        </div>
    );
}
