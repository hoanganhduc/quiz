import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Switch";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";

export type ConnectionStatus = "idle" | "checking" | "connected" | "error";

type Props = {
  apiBase: string;
  onApiBaseChange: (value: string) => void;
  adminToken?: string;
  onAdminTokenChange?: (value: string) => void;
  tokenError?: string;
  rememberToken?: boolean;
  onRememberTokenChange?: (value: boolean) => void;
  showToken?: boolean;
  onToggleShowToken?: () => void;
  hideAdminToken?: boolean;
  hideTestButton?: boolean;
  onTestConnection: () => void;
  status: ConnectionStatus;
  statusMessage?: string;
  lastError?: string;
};

const statusTone: Record<ConnectionStatus, "muted" | "info" | "success" | "error"> = {
  idle: "muted",
  checking: "info",
  connected: "success",
  error: "error"
};

const statusLabel: Record<ConnectionStatus, string> = {
  idle: "Not tested",
  checking: "Checking",
  connected: "Connected",
  error: "Not connected"
};

export function ConnectionCard({
  apiBase,
  onApiBaseChange,
  adminToken,
  onAdminTokenChange,
  tokenError,
  rememberToken,
  onRememberTokenChange,
  showToken,
  onToggleShowToken,
  hideAdminToken = false,
  hideTestButton = false,
  onTestConnection,
  status,
  statusMessage,
  lastError
}: Props) {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Connection</h2>
          <p className="text-sm text-textMuted">Admin access to the Worker API.</p>
        </div>
        <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text" htmlFor="api-base">
          API Base URL
        </label>
        <Input
          id="api-base"
          value={apiBase}
          onChange={(e) => onApiBaseChange(e.target.value)}
          placeholder="https://your-worker.example.com"
        />
        <p className="text-xs text-textMuted">Stored only for this browser session.</p>
      </div>

      {hideAdminToken ? null : (
        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="admin-token">
            Admin token
          </label>
          <div className="flex gap-2">
            <Input
              id="admin-token"
              type={showToken ? "text" : "password"}
              value={adminToken ?? ""}
              onChange={(e) => onAdminTokenChange?.(e.target.value)}
              placeholder="ADMIN_TOKEN"
              hasError={Boolean(tokenError)}
              aria-describedby={tokenError ? "admin-token-error" : undefined}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => onToggleShowToken?.()}>
              {showToken ? "Hide" : "Show"}
            </Button>
          </div>
          <div className="flex items-center gap-3 text-sm text-textMuted">
            <Switch
              id="remember-token"
              checked={Boolean(rememberToken)}
              onChange={(value) => onRememberTokenChange?.(value)}
            />
            <label htmlFor="remember-token">Remember for this session</label>
          </div>
          <Alert tone="warn">
            ADMIN_TOKEN grants exam creation authority. Avoid saving it on shared machines.
          </Alert>
          {tokenError ? (
            <p className="text-xs text-error" role="alert" id="admin-token-error">
              {tokenError}
            </p>
          ) : null}
        </div>
      )}

      {hideTestButton ? (
        statusMessage ? <div className="text-sm text-textMuted">{statusMessage}</div> : null
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={onTestConnection}>
            Test Connection
          </Button>
          {statusMessage ? <span className="text-sm text-textMuted">{statusMessage}</span> : null}
        </div>
      )}

      {lastError ? (
        <Alert tone="error">
          {lastError}
        </Alert>
      ) : null}
    </Card>
  );
}
