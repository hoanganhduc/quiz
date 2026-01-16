import { ReactNode, useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { githubLoginUrl, googleLoginUrl, getSession } from "../../api";

type StatusTone = "info" | "warn" | "error" | "success";

type StatusMessage = { tone: StatusTone; text: string } | null;

type SessionLike = {
  roles?: string[];
  displayName?: string;
  providers?: string[];
  provider?: string;
};

type Props = {
  children: ReactNode;
};

export function AdminAuthGate({ children }: Props) {
  const [session, setSession] = useState<SessionLike | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);
  const [loading, setLoading] = useState(true);

  const apiBase = import.meta.env.VITE_API_BASE;

  const loadSession = async () => {
    setLoading(true);
    try {
      const sess = await getSession();
      setSession(sess);
    } catch (err: any) {
      if (err?.message?.includes("401") || err?.message?.includes("Unauthorized")) {
        setSession(null);
      } else {
        setStatus({ tone: "error", text: err?.message ?? "Failed to load session" });
        setSession(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const handleGithubLogin = () => {
    window.location.href = githubLoginUrl(window.location.href);
  };

  const handleGoogleLogin = () => {
    if (!apiBase) {
      setStatus({ tone: "error", text: "API base not configured" });
      return;
    }
    window.location.href = googleLoginUrl(window.location.href);
  };

  if (loading) {
    return <div className="p-6 text-sm text-textMuted">Loading admin session...</div>;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Admin sign-in required</h2>
            <p className="text-sm text-textMuted">Sign in to manage admin tools.</p>
          </div>
          {status ? <Alert tone={status.tone}>{status.text}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleGithubLogin}>
              Sign in with GitHub
            </Button>
            <Button variant="secondary" onClick={handleGoogleLogin}>
              Sign in with Google
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isAdmin = session.roles?.includes("admin");

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">Not authorized</h2>
              <p className="text-sm text-textMuted">Your account does not have admin access.</p>
            </div>
            <Badge tone="warn">No admin role</Badge>
          </div>
        </Card>
      </div>
    );
  }

  return <div className="pt-3">{children}</div>;
}
