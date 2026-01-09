import { useState } from "react";
import { AdminAuthGate } from "../../components/admin/AdminAuthGate";
import { PageShell } from "../../components/layout/PageShell";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Badge } from "../../components/ui/Badge";
import { Alert } from "../../components/ui/Alert";

type UserSummary = {
  appUserId: string;
  roles: string[];
  githubUsername?: string;
  googleEmail?: string;
  displayName?: string;
};

type StatusTone = "info" | "warn" | "error" | "success";

type StatusMessage = { tone: StatusTone; text: string } | null;

export function AdminUsersPage() {
  const apiBase = import.meta.env.VITE_API_BASE;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>(null);

  const runSearch = async () => {
    if (!apiBase) {
      setStatus({ tone: "error", text: "API base not configured" });
      return;
    }
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/admin/users/search?q=${encodeURIComponent(trimmed)}`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { users: UserSummary[] };
      setResults(data.users ?? []);
    } catch (err: any) {
      setStatus({ tone: "error", text: err?.message ?? "Search failed" });
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (appUserId: string, makeAdmin: boolean) => {
    if (!apiBase) {
      setStatus({ tone: "error", text: "API base not configured" });
      return;
    }
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/admin/users/${appUserId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ makeAdmin })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { user: UserSummary };
      setResults((prev) => prev.map((item) => (item.appUserId === appUserId ? data.user : item)));
      setStatus({ tone: "success", text: makeAdmin ? "User promoted" : "User demoted" });
    } catch (err: any) {
      setStatus({ tone: "error", text: err?.message ?? "Update failed" });
    }
  };

  return (
    <AdminAuthGate>
      <PageShell maxWidth="4xl" className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-text">Admin Users</h1>
          <p className="text-sm text-textMuted">Search and manage admin roles.</p>
        </div>

        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="text-sm font-medium text-text" htmlFor="user-search">
                Search users
              </label>
              <Input
                id="user-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="appUserId, GitHub username, or Google email"
              />
            </div>
            <Button onClick={runSearch} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </div>
          {status ? <Alert tone={status.tone}>{status.text}</Alert> : null}
        </Card>

        <div className="space-y-3">
          {results.length === 0 ? (
            <Card>
              <p className="text-sm text-textMuted">No results.</p>
            </Card>
          ) : (
            results.map((user) => {
              const isAdmin = user.roles.includes("admin");
              return (
                <Card key={user.appUserId} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text">{user.displayName ?? "(No name)"}</div>
                      <div className="text-xs text-textMuted font-mono break-all">{user.appUserId}</div>
                    </div>
                    <Badge tone={isAdmin ? "success" : "muted"}>{isAdmin ? "Admin" : "User"}</Badge>
                  </div>
                  <div className="grid gap-2 text-sm text-textMuted">
                    <div>GitHub: {user.githubUsername ?? "—"}</div>
                    <div>Google: {user.googleEmail ?? "—"}</div>
                  </div>
                  <div className="flex gap-2">
                    {isAdmin ? (
                      <Button variant="secondary" onClick={() => updateRole(user.appUserId, false)}>
                        Demote
                      </Button>
                    ) : (
                      <Button onClick={() => updateRole(user.appUserId, true)}>Promote to admin</Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </PageShell>
    </AdminAuthGate>
  );
}
