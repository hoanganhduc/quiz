import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import clsx from "clsx";
import type { Session } from "../../api";
import { githubLoginUrl, googleLoginUrl } from "../../api";
import { Badge } from "../ui/Badge";
import { IconClock, IconLogin, IconLogout, IconMenu, IconPlay, IconQuestion, IconSettings, IconShield, IconUser, IconX } from "../ui/Icons";
import { HelpDrawer } from "./HelpDrawer";

type SessionLike = Session & {
  roles?: string[];
  displayName?: string;
  providers?: string[];
  username?: string;
};

function navLinkClass({ isActive }: { isActive: boolean }) {
  return clsx(
    "inline-flex items-center rounded-lg px-3 py-2 text-sm border min-h-[44px]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900",
    isActive
      ? "bg-muted border-border text-text"
      : "bg-transparent border-transparent hover:bg-muted text-textMuted"
  );
}

function mobileNavLinkClass({ isActive }: { isActive: boolean }) {
  return clsx(
    "flex items-center gap-3 rounded-lg px-4 py-3 text-base border min-h-[48px] w-full",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
    isActive
      ? "bg-muted border-border text-text font-medium"
      : "bg-transparent border-transparent hover:bg-muted text-textMuted"
  );
}

export function TopBar({ session }: { session: SessionLike | null }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navItems = (
    <>
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
    </>
  );

  const mobileNavItems = (
    <>
      <NavLink to="/" className={mobileNavLinkClass} end onClick={closeMobileMenu}>
        <IconPlay className="h-5 w-5" />
        <span>Take Exam</span>
      </NavLink>
      {session ? (
        <>
          <NavLink to="/history" className={mobileNavLinkClass} onClick={closeMobileMenu}>
            <IconClock className="h-5 w-5" />
            <span>My History</span>
          </NavLink>
          <NavLink to="/account" className={mobileNavLinkClass} onClick={closeMobileMenu}>
            <IconUser className="h-5 w-5" />
            <span>Account</span>
          </NavLink>
          {isAdmin ? (
            <NavLink to="/admin" className={mobileNavLinkClass} onClick={closeMobileMenu}>
              <IconShield className="h-5 w-5" />
              <span>Admin</span>
            </NavLink>
          ) : null}
          <NavLink to="/settings" className={mobileNavLinkClass} onClick={closeMobileMenu}>
            <IconSettings className="h-5 w-5" />
            <span>Settings</span>
          </NavLink>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-4">
            <Link to="/" className="font-semibold text-text text-lg">
              Quiz
            </Link>
            {/* Desktop nav - hidden on mobile */}
            <nav className="hidden md:flex flex-wrap items-center gap-1">
              {navItems}
            </nav>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Help button */}
            <button
              type="button"
              className={clsx(navLinkClass({ isActive: false }), "hidden sm:inline-flex")}
              onClick={() => setHelpOpen(true)}
            >
              <span className="inline-flex items-center gap-2">
                <IconQuestion className="h-4 w-4" />
                <span>Help</span>
              </span>
            </button>

            {session ? (
              <>
                {/* User badge - hidden on small mobile */}
                <Link
                  to="/account"
                  className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-text hover:bg-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900"
                >
                  <span className="truncate max-w-[150px]">{displayName}</span>
                  <Badge tone={isAdmin ? "info" : "muted"}>{isAdmin ? "Admin" : "User"}</Badge>
                </Link>
                {/* Logout - hidden on mobile (in drawer instead) */}
                <button type="button" className={clsx(navLinkClass({ isActive: false }), "hidden md:inline-flex")} onClick={handleLogout}>
                  <span className="inline-flex items-center gap-2">
                    <IconLogout className="h-4 w-4" />
                    <span>Logout</span>
                  </span>
                </button>
              </>
            ) : (
              <>
                {/* Sign in dropdown - desktop only */}
                <details className="relative hidden md:block">
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
                        className="w-full rounded-md border border-transparent bg-transparent px-3 py-3 text-left text-sm font-medium text-text transition-colors hover:bg-muted hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50 min-h-[44px]"
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
                        className="w-full rounded-md border border-transparent bg-transparent px-3 py-3 text-left text-sm font-medium text-text transition-colors hover:bg-muted hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50 min-h-[44px]"
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

            {/* Mobile hamburger button */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 min-h-[44px] min-w-[44px] text-textMuted hover:bg-muted border border-transparent hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <IconMenu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />
          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-[280px] max-w-[85vw] bg-card border-l border-border shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <span className="font-semibold text-text text-lg">Menu</span>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg p-2 min-h-[44px] min-w-[44px] text-textMuted hover:bg-muted border border-transparent hover:border-border"
                onClick={closeMobileMenu}
                aria-label="Close menu"
              >
                <IconX className="h-6 w-6" />
              </button>
            </div>

            {/* User info on mobile */}
            {session && (
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text font-medium truncate">{displayName}</span>
                  <Badge tone={isAdmin ? "info" : "muted"} className="text-xs">{isAdmin ? "Admin" : "User"}</Badge>
                </div>
              </div>
            )}

            <nav className="p-2 space-y-1">
              {mobileNavItems}
            </nav>

            {/* Mobile-only help button */}
            <div className="p-2 border-t border-border">
              <button
                type="button"
                className={mobileNavLinkClass({ isActive: false })}
                onClick={() => { closeMobileMenu(); setHelpOpen(true); }}
              >
                <IconQuestion className="h-5 w-5" />
                <span>Help</span>
              </button>
            </div>

            {/* Mobile login/logout */}
            <div className="p-2 border-t border-border">
              {session ? (
                <button
                  type="button"
                  className={clsx(mobileNavLinkClass({ isActive: false }), "text-error")}
                  onClick={() => { closeMobileMenu(); handleLogout(); }}
                >
                  <IconLogout className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    disabled={!apiBase}
                    className={mobileNavLinkClass({ isActive: false })}
                    onClick={startGithubLogin}
                  >
                    <IconLogin className="h-5 w-5" />
                    <span>Sign in with GitHub</span>
                  </button>
                  <button
                    type="button"
                    disabled={!apiBase}
                    className={mobileNavLinkClass({ isActive: false })}
                    onClick={startGoogleLogin}
                  >
                    <IconLogin className="h-5 w-5" />
                    <span>Sign in with Google</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
