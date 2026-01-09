import { useMemo } from "react";
import { Button } from "../ui/Button";
import { CodeBlock } from "../ui/CodeBlock";
import { Alert } from "../ui/Alert";
import { Switch } from "../ui/Switch";
import { Card } from "../ui/Card";
import { Accordion } from "../ui/Accordion";

type Props = {
  body: unknown;
  warnings: string[];
  errors: Record<string, string>;
  apiBase: string;
  adminToken?: string;
  includeTokenInCurl?: boolean;
  onIncludeTokenInCurlChange?: (value: boolean) => void;
  sessionAuth?: boolean;
  onCopyJson: (text: string) => void;
  onCopyCurl: (text: string) => void;
  collapsible?: boolean;
  idPrefix?: string;
};

export function RequestPreview({
  body,
  warnings,
  errors,
  apiBase,
  adminToken,
  includeTokenInCurl = false,
  onIncludeTokenInCurlChange,
  sessionAuth = false,
  onCopyJson,
  onCopyCurl,
  collapsible = false,
  idPrefix = "request-preview"
}: Props) {
  const json = useMemo(() => JSON.stringify(body, null, 2), [body]);
  const curl = useMemo(() => {
    const payload = JSON.stringify(body);
    const base = apiBase.replace(/\/$/, "");
    if (sessionAuth) {
      return `curl -X POST '${base}/admin/exams' -H 'Content-Type: application/json' -b "<SESSION_COOKIE>" -d '${payload}'`;
    }
    const tokenPart = includeTokenInCurl ? adminToken || "<ADMIN_TOKEN>" : "<ADMIN_TOKEN>";
    return `curl -X POST '${base}/admin/exams' -H 'Authorization: Bearer ${tokenPart}' -H 'Content-Type: application/json' -d '${payload}'`;
  }, [apiBase, adminToken, body, includeTokenInCurl, sessionAuth]);

  const errorList = Object.values(errors);

  const switchId = `${idPrefix}-include-token`;
  const content = (
    <div className="space-y-3">
      {!collapsible ? (
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">Request Preview</h3>
          {sessionAuth ? (
            <div className="text-xs text-textMuted">Uses admin session cookie</div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-textMuted">
              <Switch
                id={switchId}
                checked={includeTokenInCurl}
                onChange={(value) => onIncludeTokenInCurlChange?.(value)}
              />
              <label htmlFor={switchId}>Include token in curl</label>
            </div>
          )}
        </div>
      ) : sessionAuth ? (
        <div className="text-xs text-textMuted">Uses admin session cookie</div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-textMuted">
          <Switch
            id={switchId}
            checked={includeTokenInCurl}
            onChange={(value) => onIncludeTokenInCurlChange?.(value)}
          />
          <label htmlFor={switchId}>Include token in curl</label>
        </div>
      )}

      {errorList.length > 0 ? (
        <Alert tone="error">
          {errorList.map((err, idx) => (
            <div key={`${err}-${idx}`}>{err}</div>
          ))}
        </Alert>
      ) : null}

      {warnings.length > 0 ? (
        <Alert tone="warn">
          {warnings.map((warn, idx) => (
            <div key={`${warn}-${idx}`}>{warn}</div>
          ))}
        </Alert>
      ) : null}

      <CodeBlock>{json}</CodeBlock>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => onCopyJson(json)}>
          Copy JSON
        </Button>
        <Button type="button" variant="ghost" onClick={() => onCopyCurl(curl)}>
          Copy curl
        </Button>
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <Accordion title="Request Preview" defaultOpen={false}>
        {content}
      </Accordion>
    );
  }

  return <Card className="space-y-3">{content}</Card>;
}
