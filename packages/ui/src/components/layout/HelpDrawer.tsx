import { useEffect, useMemo } from "react";
import clsx from "clsx";
import { Button } from "../ui/Button";

function buildDocUrl(docPath: string, override?: string) {
  if (override) return override;

  const repoUrl = (import.meta.env.VITE_REPO_URL as string | undefined)?.trim();
  if (repoUrl) {
    const base = repoUrl.replace(/\/$/, "");
    return `${base}/blob/main/${docPath}`;
  }

  // Fallback: repo-relative path (may only work in some deployments).
  return `/${docPath}`;
}

export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const links = useMemo(() => {
    return {
      userGuide: buildDocUrl("docs/user-guide.md", (import.meta.env.VITE_DOCS_USER_GUIDE_URL as string | undefined)?.trim()),
      sourceAdmin: buildDocUrl("docs/source-admin.md", (import.meta.env.VITE_DOCS_SOURCE_ADMIN_URL as string | undefined)?.trim())
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Help">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className={clsx(
          "absolute right-0 top-0 h-full w-full max-w-md",
          "bg-card border-l border-border shadow-card",
          "p-4 overflow-auto"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-text">Help</h2>
            <p className="text-sm text-textMuted">Guides and answers to common questions.</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-border bg-muted p-3">
            <div className="text-sm font-semibold text-text">Guides</div>
            <ul className="mt-2 space-y-2 text-sm">
              <li>
                <a className="text-info hover:underline" href={links.userGuide} target="_blank" rel="noreferrer">
                  Student guide
                </a>
                <div className="text-xs text-textMuted">docs/user-guide.md</div>
              </li>
              <li>
                <a className="text-info hover:underline" href={links.sourceAdmin} target="_blank" rel="noreferrer">
                  Admin sources guide
                </a>
                <div className="text-xs text-textMuted">docs/source-admin.md</div>
              </li>
            </ul>
            <div className="mt-3 text-xs text-textMuted">
              If these links don’t work in your deployment, set <span className="font-mono">VITE_DOCS_USER_GUIDE_URL</span>,
              <span className="font-mono"> VITE_DOCS_SOURCE_ADMIN_URL</span>, or <span className="font-mono">VITE_REPO_URL</span>.
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-sm font-semibold text-text">Common questions</div>
            <div className="mt-2 space-y-2">
              <details className="rounded-lg border border-border bg-muted px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-text">What is view code?</summary>
                <div className="mt-2 text-sm text-textMuted">
                  A <strong>view code</strong> lets you open an exam in a view-only mode. You can read questions and interact with
                  the UI, but you typically can’t submit for a score.
                </div>
              </details>

              <details className="rounded-lg border border-border bg-muted px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-text">When do solutions show?</summary>
                <div className="mt-2 text-sm text-textMuted">
                  It depends on how the exam was configured. Some exams show solutions after you submit; others hide solutions until
                  the exam window ends.
                </div>
              </details>

              <details className="rounded-lg border border-border bg-muted px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-text">Why sign in?</summary>
                <div className="mt-2 text-sm text-textMuted">
                  Signing in links your attempt to your account so you can revisit results in <strong>My History</strong>. Some exams
                  also require sign-in before you can start.
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
