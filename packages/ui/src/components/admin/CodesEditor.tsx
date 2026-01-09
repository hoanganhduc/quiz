import { useMemo, useState } from "react";
import type { ExamPolicyV1 } from "@app/shared";
import { Card } from "../ui/Card";
import { Switch } from "../ui/Switch";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { Accordion } from "../ui/Accordion";

function normalizeCodes(codes: string[]): string[] {
  const trimmed = codes.map((code) => code.trim()).filter(Boolean);
  return Array.from(new Set(trimmed));
}

function randomCode(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = new Uint32Array(length);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(values);
  } else {
    for (let i = 0; i < length; i += 1) values[i] = Math.floor(Math.random() * alphabet.length);
  }
  return Array.from(values)
    .map((v) => alphabet[v % alphabet.length])
    .join("");
}

type Props = {
  codesEnabled: boolean;
  codes: string[];
  policy: ExamPolicyV1;
  onCodesEnabledChange: (value: boolean) => void;
  onCodesChange: (codes: string[]) => void;
};

export function CodesEditor({ codesEnabled, codes, policy, onCodesEnabledChange, onCodesChange }: Props) {
  const [bulkInput, setBulkInput] = useState("");
  const [singleCode, setSingleCode] = useState("");
  const [generateCount, setGenerateCount] = useState(5);

  const normalizedCodes = useMemo(() => normalizeCodes(codes), [codes]);
  const showWarning = (policy.requireViewCode || policy.requireSubmitCode) && normalizedCodes.length === 0;

  const addCodes = (incoming: string[]) => {
    onCodesChange(normalizeCodes([...normalizedCodes, ...incoming]));
  };

  const removeCode = (code: string) => {
    onCodesChange(normalizeCodes(normalizedCodes.filter((c) => c !== code)));
  };

  const onBulkAdd = () => {
    if (!bulkInput.trim()) return;
    addCodes(bulkInput.split(/\r?\n/));
    setBulkInput("");
  };

  const onSingleAdd = () => {
    if (!singleCode.trim()) return;
    addCodes([singleCode]);
    setSingleCode("");
  };

  const onGenerate = () => {
    const count = Math.max(1, Math.min(200, Math.floor(generateCount)));
    const generated = Array.from({ length: count }, () => randomCode(10));
    addCodes(generated);
  };

  return (
    <Accordion title="Access Codes" defaultOpen={false} tone={showWarning ? "warn" : "muted"}>
      <Card className="space-y-4" padding="sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-text">Access codes</h3>
            <p className="text-xs text-textMuted">Codes are case-sensitive and never leave your browser.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-textMuted">
            <Switch id="codes-enabled" checked={codesEnabled} onChange={onCodesEnabledChange} />
            <label htmlFor="codes-enabled">Use access codes</label>
          </div>
        </div>

        {showWarning ? (
          <Alert tone="warn">
            Policy requires access codes, but the list is empty. Students will not be blocked.
          </Alert>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="bulk-codes">
            Bulk add codes (one per line)
          </label>
          <Textarea
            id="bulk-codes"
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder="MATH3500-01\nMATH3500-02"
            rows={4}
            disabled={!codesEnabled}
          />
          <Button type="button" variant="secondary" size="sm" onClick={onBulkAdd} disabled={!codesEnabled}>
            Add codes
          </Button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="single-code">
            Add a single code
          </label>
          <div className="flex gap-2">
            <Input
              id="single-code"
              value={singleCode}
              onChange={(e) => setSingleCode(e.target.value)}
              placeholder="EXAM-ACCESS"
              disabled={!codesEnabled}
            />
            <Button type="button" variant="secondary" size="sm" onClick={onSingleAdd} disabled={!codesEnabled}>
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="generate-count">
            Generate random codes
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="generate-count"
              type="number"
              min={1}
              max={200}
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value))}
              className="w-24"
              disabled={!codesEnabled}
            />
            <Button type="button" variant="secondary" size="sm" onClick={onGenerate} disabled={!codesEnabled}>
              Generate (length 10)
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-text">Codes list</p>
          {normalizedCodes.length === 0 ? (
            <p className="text-xs text-textMuted">No codes added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {normalizedCodes.map((code) => (
                <Badge key={code} tone="info" className="gap-2">
                  {code}
                  <button
                    type="button"
                    onClick={() => removeCode(code)}
                    className="text-xs text-textMuted hover:text-text"
                    aria-label={`Remove code ${code}`}
                    disabled={!codesEnabled}
                  >
                    ✕
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>
    </Accordion>
  );
}
