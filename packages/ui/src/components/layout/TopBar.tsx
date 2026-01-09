import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import clsx from "clsx";
import type { Session } from "../../api";
import { githubLoginUrl, googleLoginUrl } from "../../api";
import { Badge } from "../ui/Badge";
import { IconClock, IconLogin, IconLogout, IconPlay, IconQuestion, IconSettings, IconShield, IconUser } from "../ui/Icons";
import { HelpDrawer } from "./HelpDrawer";

type SessionLike = Session & {
  roles?: string[];
  displayName?: string;
  providers?: string[];
  username?: string;
};

function navLinkClass({ isActive }: { isActive: boolean }) {
  return clsx(
    "inline-flex items-center rounded-lg px-3 py-2 text-sm border",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900",
    isActive
      ? "bg-muted border-border text-text"
      : "bg-transparent border-transparent hover:bg-muted text-textMuted"
  );
}


export function TopBar({ session }: { session: SessionLike | null }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const isAdmin = !!session?.roles?.includes("admin");

  const apiBase = import.meta.env.VITE_API_BASE as string | undefined;

  const displayName = !session
    ? null
    : session.provider === "anon"
      ? "Anonymous"
      : session.displayName ?? (session as any).name ?? session.username ?? "User";

  const handleLogout = async () => {
    if (!apiBase) return;
    await fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.reload();
  };

  const startGithubLogin = () => {
    if (!apiBase) return;
    window.location.href = githubLoginUrl(window.location.href);
  };

  const startGoogleLogin = () => {
    if (!apiBase) return;
    window.location.href = googleLoginUrl(window.location.href);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="font-semibold text-text">
              Quiz
            </Link>
            <nav className="flex flex-wrap items-center gap-1">
              <NavLink to="/" className={navLinkClass} end>
                <span className="inline-flex items-center gap-2">
                  <IconPlay className="h-4 w-4" />
                  <span>Take Exam</span>
                </span>
              </NavLink>
              {session ? (
                <>
                  <NavLink to="/history" className={navLinkClass}>
                    <span className="inline-flex items-center gap-2">
                      <IconClock className="h-4 w-4" />
                      <span>My History</span>
                    </span>
                  </NavLink>
                  <NavLink to="/account" className={navLinkClass}>
                    <span className="inline-flex items-center gap-2">
                      <IconUser className="h-4 w-4" />
                      <span>Account</span>
                    </span>
                  </NavLink>
                  {isAdmin ? (
                    <NavLink to="/admin" className={navLinkClass}>
                      <span className="inline-flex items-center gap-2">
                        <IconShield className="h-4 w-4" />
                        <span>Admin</span>
                      </span>
                    </NavLink>
                  ) : null}
                  <NavLink to="/settings" className={navLinkClass}>
                    <span className="inline-flex items-center gap-2">
                      <IconSettings className="h-4 w-4" />
                      <span>Settings</span>
                    </span>
                  </NavLink>
                </>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" className={navLinkClass({ isActive: false })} onClick={() => setHelpOpen(true)}>
              <span className="inline-flex items-center gap-2">
                <IconQuestion className="h-4 w-4" />
                <span>Help</span>
              </span>
            </button>

            {session ? (
              <>
                <Link
                  to="/account"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-text hover:bg-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900"
                >
                  <span className="truncate max-w-[200px]">{displayName}</span>
                  <Badge tone={isAdmin ? "info" : "muted"}>{isAdmin ? "Admin" : "User"}</Badge>
                </Link>
                <button type="button" className={navLinkClass({ isActive: false })} onClick={handleLogout}>
                  <span className="inline-flex items-center gap-2">
                    <IconLogout className="h-4 w-4" />
                    <span>Logout</span>
                  </span>
                </button>
              </>
            ) : (
              <>
                <details className="relative">
                  <summary
                    className={clsx(
                      navLinkClass({ isActive: false }),
                      "cursor-pointer list-none [&_::-webkit-details-marker]:hidden"
                    )}
                  >
                    Sign in
                  </summary>
                  <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-card shadow-[0_12px_32px_rgba(0,0,0,0.20)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.60)]">
                    <div className="px-3 py-2 text-xs font-medium text-textMuted">Sign in with</div>
                    <div className="p-1 space-y-1">
                      <button
                        type="button"
                        disabled={!apiBase}
                        className="w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-muted hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50"
                        onClick={startGithubLogin}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2">
                            <IconLogin className="h-4 w-4 text-textMuted" />
                            <span>Continue with GitHub</span>
                          </span>
                          <span className="text-textMuted">→</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={!apiBase}
                        className="w-full rounded-md border border-transparent bg-transparent px-3 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-muted hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50"
                        onClick={startGoogleLogin}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2">
                            <IconLogin className="h-4 w-4 text-textMuted" />
                            <span>Continue with Google</span>
                          </span>
                          <span className="text-textMuted">→</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      </header>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
