import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import clsx from "clsx";
import { PageShell } from "../components/layout/PageShell";
import { useTheme } from "../theme/useTheme";
import { AdminAuthGate } from "../components/admin/AdminAuthGate";
import { getR2Usage, setDefaultTimezone, type R2UsageResponse } from "../api/sourcesAdmin";
import { getDefaultTimezone } from "../api";
import { formatDateTime, listTimezones, setCachedTimezone } from "../utils/time";

type Notice = { tone: "success" | "error" | "warn" | "info"; text: string };

export function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const Option = ({ value, label }: { value: "light" | "dark" | "system"; label: string }) => {
    const active = theme === value;
    return (
      <Button
        type="button"
        size="sm"
        variant={active ? "primary" : "secondary"}
        onClick={() => setTheme(value)}
        className={clsx("min-w-[90px]", active ? "" : "hover:bg-muted/70")}
        aria-pressed={active}
      >
        {label}
      </Button>
    );
  };

  return (
    <PageShell maxWidth="3xl" className="space-y-4">
      <Card className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Appearance</h1>
          <p className="text-sm text-textMuted">Choose how the UI looks on this device.</p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-text">Theme</div>
          <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-2">
            <Option value="light" label="Light" />
            <Option value="dark" label="Dark" />
            <Option value="system" label="System" />
          </div>
          <div className="text-xs text-textMuted">Current: {resolvedTheme}</div>
        </div>
      </Card>

      <AdminAuthGate>
        <TimezoneSettingsCard />
        <UploadUsageCard />
      </AdminAuthGate>
    </PageShell>
  );
}

function TimezoneSettingsCard() {
  const [timezone, setTimezone] = useState("UTC");
  const [options, setOptions] = useState<string[]>(() => listTimezones());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    setOptions(listTimezones());
    getDefaultTimezone()
      .then((tz) => {
        if (tz) {
          setTimezone(tz);
          setCachedTimezone(tz);
        }
      })
      .catch((err: any) => {
        setNotice({ tone: "warn", text: err?.message ?? "Failed to load timezone" });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await setDefaultTimezone(timezone);
      setCachedTimezone(res.timezone);
      setNotice({ tone: "success", text: `Default timezone set to ${res.timezone}` });
    } catch (err: any) {
      setNotice({ tone: "error", text: err?.message ?? "Failed to save timezone" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-text">Default timezone</h2>
        <p className="text-sm text-textMuted">All time displays use this timezone across the app.</p>
      </div>
      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text" htmlFor="default-timezone">
          Timezone
        </label>
        <select
          id="default-timezone"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-info"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          disabled={loading || saving}
        >
          {options.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <div className="text-xs text-textMuted">
          Current: {timezone}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={handleSave} disabled={loading || saving}>
          {saving ? "Saving..." : "Save timezone"}
        </Button>
      </div>
    </Card>
  );
}

function UploadUsageCard() {
  const [r2Usage, setR2Usage] = useState<R2UsageResponse | null>(null);
  const [r2Notice, setR2Notice] = useState<Notice | null>(null);

  const refreshR2Usage = async (showCleanupNotice = false) => {
    try {
      const res = await getR2Usage();
      setR2Usage(res);
      setR2Notice(null);
      if (showCleanupNotice && res.deleted > 0) {
        setR2Notice({ tone: "info", text: `Cleaned up ${res.deleted} expired uploads.` });
      }
    } catch (err: any) {
      setR2Notice({ tone: "warn", text: err?.message ?? "Failed to load R2 usage" });
    }
  };

  useEffect(() => {
    void refreshR2Usage();
  }, []);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">Upload</h2>
          <p className="text-sm text-textMuted">Tracks usage and recent admin uploads.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => refreshR2Usage(false)}>
            Refresh
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={() => refreshR2Usage(true)}>
            Cleanup expired
          </Button>
        </div>
      </div>

      {r2Notice ? <Alert tone={r2Notice.tone}>{r2Notice.text}</Alert> : null}
      {r2Usage?.warnings?.length ? (
        <Alert tone="warn">
          {r2Usage.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-textMuted">Stored</div>
          <div className="text-sm font-semibold text-text">{formatBytes(r2Usage?.usage?.bytesStored ?? 0)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-textMuted">Class A ops</div>
          <div className="text-sm font-semibold text-text">{r2Usage?.usage?.classA ?? 0}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-textMuted">Class B ops</div>
          <div className="text-sm font-semibold text-text">{r2Usage?.usage?.classB ?? 0}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-textMuted">Uploaded</div>
          <div className="text-sm font-semibold text-text">{formatBytes(r2Usage?.usage?.bytesUploaded ?? 0)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-textMuted">Downloaded</div>
          <div className="text-sm font-semibold text-text">{formatBytes(r2Usage?.usage?.bytesDownloaded ?? 0)}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-textMuted">Upload limit</div>
          <div className="text-sm font-semibold text-text">{formatBytes(r2Usage?.maxUploadBytes ?? 0)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-textMuted">Auto-delete TTL</div>
          <div className="text-sm font-semibold text-text">{r2Usage?.uploadTtlHours ?? 0} hours</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-semibold text-text">Recent uploads</div>
        {r2Usage?.uploads?.length ? (
          <div className="space-y-2 text-xs">
            {r2Usage.uploads.map((upload) => (
              <div key={`${upload.key}-${upload.at}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <div className="min-w-0">
                  <div className="text-textMuted">{formatUpdatedAt(upload.at)}</div>
                  <div className="font-mono text-xs truncate">{upload.key}</div>
                </div>
                <div className="flex items-center gap-2 text-textMuted">
                  <span>{upload.scope}</span>
                  <span>{formatBytes(upload.bytes)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-textMuted">No uploads logged yet.</div>
        )}
      </div>
    </Card>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatUpdatedAt(value: string) {
  return formatDateTime(value);
}
