import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export type ExamResult = {
  examId: string;
  examUrl: string;
  seed: string;
};

type Props = {
  result: ExamResult;
  onCreateAnother: () => void;
  onCopyShortLink?: () => void;
  shortLinkLoading?: boolean;
};

export function ResultCard({ result, onCreateAnother, onCopyShortLink, shortLinkLoading }: Props) {
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-text">Exam Created</h3>
        <p className="text-sm text-textMuted">Share the link with students or open it now.</p>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-textMuted">Exam ID</p>
          <p className="font-mono text-sm text-text">{result.examId}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-textMuted">Exam URL</p>
          <a className="text-indigo-600 hover:text-indigo-700 break-all" href={result.examUrl} target="_blank" rel="noreferrer">
            {result.examUrl}
          </a>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-textMuted">Seed</p>
          <p className="font-mono text-sm text-text">{result.seed}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => window.open(result.examUrl, "_blank")}>Open exam</Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigator.clipboard.writeText(result.examUrl)}
        >
          Copy exam URL
        </Button>
        {onCopyShortLink ? (
          <Button type="button" variant="secondary" onClick={onCopyShortLink} disabled={shortLinkLoading}>
            {shortLinkLoading ? "Copying..." : "Copy short link"}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={() => navigator.clipboard.writeText(result.seed)}>
          Copy seed
        </Button>
        <Button type="button" variant="ghost" onClick={onCreateAnother}>
          Create another
        </Button>
      </div>
    </Card>
  );
}
