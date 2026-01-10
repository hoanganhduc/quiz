import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveShortLink } from "../api";
import { PageShell } from "../components/layout/PageShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function ShortLinkRedirect() {
  const { code = "" } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("Missing short link code.");
      return;
    }
    let cancelled = false;
    resolveShortLink(code)
      .then((res) => {
        if (cancelled) return;
        navigate(`/exam/${encodeURIComponent(res.subject)}/${encodeURIComponent(res.examId)}`, { replace: true });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message ?? "Short link not found.");
      });
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <PageShell maxWidth="3xl" className="py-8">
      <Card className="space-y-3">
        <div className="text-base font-semibold text-text">Opening exam…</div>
        <div className="text-sm text-textMuted">
          {error ?? "If nothing happens, the short link may be invalid."}
        </div>
        {error ? (
          <Button type="button" variant="secondary" onClick={() => navigate("/")}>
            Go home
          </Button>
        ) : null}
      </Card>
    </PageShell>
  );
}
