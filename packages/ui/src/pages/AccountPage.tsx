import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { IconLink } from "../components/ui/Icons";
import { Badge } from "../components/ui/Badge";
import { PageShell } from "../components/layout/PageShell";
import { getSession, githubLinkUrl, googleLinkUrl } from "../api";

type StatusTone = "info" | "warn" | "error" | "success";

type StatusMessage = { tone: StatusTone; text: string } | null;

type SessionLike = {
  providers?: string[];
  provider?: string;
  displayName?: string;
  roles?: string[];
};

export function AccountPage() {
  const [session, setSession] = useState<SessionLike | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [loading, setLoading] = useState(true);

  const apiBase = import.meta.env.VITE_API_BASE;

  useEffect(() => {
    setLoading(true);
    getSession()
      .then((sess) => setSession(sess as SessionLike | null))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  const providers = session?.providers ?? (session?.provider ? [session.provider] : []);
  const isLinkedGithub = providers.includes("github");
  const isLinkedGoogle = providers.includes("google");

  const handleGithubLink = () => {
    window.location.href = githubLinkUrl(window.location.href);
  };

  const handleGoogleLink = () => {
    if (!apiBase) {
      setStatus({ tone: "error", text: "API base not configured" });
      return;
    }
    window.location.href = googleLinkUrl(window.location.href);
  };

  return (
    <PageShell maxWidth="3xl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Account</h1>
        <p className="text-sm text-textMuted">Manage linked providers and session.</p>
      </div>

      {status ? <Alert tone={status.tone}>{status.text}</Alert> : null}

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">Linked providers</h2>
            <p className="text-sm text-textMuted">Link accounts for sign-in flexibility.</p>
          </div>
          {session?.roles?.includes("admin") ? <Badge tone="info">Admin</Badge> : null}
        </div>

        {loading ? (
          <p className="text-sm text-textMuted">Loading session...</p>
        ) : session ? (
          <div className="flex flex-wrap gap-2">
            <Badge tone={isLinkedGithub ? "success" : "muted"}>GitHub</Badge>
            <Badge tone={isLinkedGoogle ? "success" : "muted"}>Google</Badge>
            {!isLinkedGithub && !isLinkedGoogle ? <Badge tone="warn">No providers linked</Badge> : null}
          </div>
        ) : (
          <Alert tone="warn">Not logged in. Sign in via an exam page to link providers.</Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<IconLink className="h-4 w-4" />}
            onClick={handleGithubLink}
            disabled={!session || isLinkedGithub}
          >
            {isLinkedGithub ? "GitHub linked" : "Link GitHub"}
          </Button>
          <Button
            variant="secondary"
            icon={<IconLink className="h-4 w-4" />}
            onClick={handleGoogleLink}
            disabled={!session || isLinkedGoogle}
          >
            {isLinkedGoogle ? "Google linked" : "Link Google"}
          </Button>
        </div>
      </Card>

    </PageShell>
  );
}
