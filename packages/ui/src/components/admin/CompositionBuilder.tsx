import { useMemo, useState } from "react";
import type { BankPublicV1, ExamCompositionItemV1 } from "@app/shared";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";

export type BankStats = {
  topics: string[];
  counts: Record<string, { basic: number; advanced: number }>;
  total: number;
  subject: string;
};

type Props = {
  composition: ExamCompositionItemV1[];
  onChange: (next: ExamCompositionItemV1[]) => void;
  errors?: Record<string, string>;
  bankStats?: BankStats | null;
  onBankStatsChange?: (stats: BankStats | null) => void;
};

const defaultPresetTopics = ["logic", "sets", "graphs"];

export function CompositionBuilder({ composition, onChange, errors = {}, bankStats: externalBankStats, onBankStatsChange }: Props) {
  const [localBankStats, setLocalBankStats] = useState<BankStats | null>(null);
  const bankStats = externalBankStats ?? localBankStats;
  const setBankStats = onBankStatsChange ?? setLocalBankStats;
  const [bankError, setBankError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const total = composition.reduce((sum, row) => sum + (Number.isInteger(row.n) ? row.n : 0), 0);
    const basic = composition.reduce(
      (sum, row) => sum + (row.level === "basic" && Number.isInteger(row.n) ? row.n : 0),
      0
    );
    const advanced = composition.reduce(
      (sum, row) => sum + (row.level === "advanced" && Number.isInteger(row.n) ? row.n : 0),
      0
    );
    return { total, basic, advanced };
  }, [composition]);

  const topics = bankStats?.topics.length ? bankStats.topics : defaultPresetTopics;

  const presets: { label: string; rows: ExamCompositionItemV1[] }[] = [
    {
      label: "Balanced 30",
      rows: [
        { topic: topics[0] || "topic-a", level: "basic", n: 12 },
        { topic: topics[1] || "topic-b", level: "basic", n: 8 },
        { topic: topics[2] || "topic-c", level: "advanced", n: 10 }
      ]
    },
    {
      label: "Advanced 20",
      rows: [
        { topic: topics[0] || "topic-a", level: "advanced", n: 10 },
        { topic: topics[1] || "topic-b", level: "advanced", n: 10 }
      ]
    }
  ];

  const updateRow = (idx: number, patch: Partial<ExamCompositionItemV1>) => {
    onChange(
      composition.map((row, i) => (i === idx ? { ...row, ...patch } : row))
    );
  };

  const removeRow = (idx: number) => {
    onChange(composition.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onChange([...composition, { topic: "", level: "basic", n: 1 }]);
  };

  const onFileChange = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as BankPublicV1;
        if (data.version !== "v1" || !Array.isArray(data.questions)) {
          throw new Error("Not a bank.public.v1.json file.");
        }
        const counts: BankStats["counts"] = {};
        for (const q of data.questions) {
          if (!counts[q.topic]) {
            counts[q.topic] = { basic: 0, advanced: 0 };
          }
          counts[q.topic][q.level] += 1;
        }
        const topics = Object.keys(counts).sort();
        setBankStats({ topics, counts, total: data.questions.length, subject: data.subject });
        setBankError(null);
      } catch (err: any) {
        setBankStats(null);
        setBankError(err?.message ?? "Failed to parse bank file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text">Composition</h2>
          <p className="text-sm text-textMuted">Define topics, levels, and counts.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info">Total {totals.total}</Badge>
          <Badge tone="success">Basic {totals.basic}</Badge>
          <Badge tone="warn">Advanced {totals.advanced}</Badge>
        </div>
      </div>

      {errors["composition"] ? (
        <Alert tone="error">{errors["composition"]}</Alert>
      ) : null}
      {errors["composition.total"] ? (
        <Alert tone="error">{errors["composition.total"]}</Alert>
      ) : null}

      <div className="space-y-3">
        {composition.map((row, idx) => {
          const available = bankStats?.counts[row.topic]?.[row.level];
          const overLimit = typeof available === "number" && row.n > available;
          return (
            <div key={`${row.topic}-${idx}`} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
              <div className="space-y-1">
                <label className="text-xs font-medium text-textMuted" htmlFor={`composition-${idx}-topic`}>
                  Topic
                </label>
                <Input
                  id={`composition-${idx}-topic`}
                  value={row.topic}
                  list="topic-suggestions"
                  hasError={Boolean(errors[`composition.${idx}.topic`])}
                  onChange={(e) => updateRow(idx, { topic: e.target.value })}
                  placeholder="sets"
                  aria-describedby={errors[`composition.${idx}.topic`] ? `composition-${idx}-topic-error` : undefined}
                />
                {errors[`composition.${idx}.topic`] ? (
                  <p className="text-xs text-error" role="alert" id={`composition-${idx}-topic-error`}>
                    {errors[`composition.${idx}.topic`]}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-textMuted" htmlFor={`composition-${idx}-level`}>
                  Level
                </label>
                <Select
                  id={`composition-${idx}-level`}
                  value={row.level}
                  hasError={Boolean(errors[`composition.${idx}.level`])}
                  onChange={(e) => updateRow(idx, { level: e.target.value as ExamCompositionItemV1["level"] })}
                  aria-describedby={errors[`composition.${idx}.level`] ? `composition-${idx}-level-error` : undefined}
                >
                  <option value="basic">Basic</option>
                  <option value="advanced">Advanced</option>
                </Select>
                {errors[`composition.${idx}.level`] ? (
                  <p className="text-xs text-error" role="alert" id={`composition-${idx}-level-error`}>
                    {errors[`composition.${idx}.level`]}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-textMuted" htmlFor={`composition-${idx}-n`}>
                  N
                </label>
                <Input
                  id={`composition-${idx}-n`}
                  type="number"
                  min={1}
                  value={row.n}
                  hasError={Boolean(errors[`composition.${idx}.n`])}
                  onChange={(e) => updateRow(idx, { n: Number(e.target.value) })}
                  aria-describedby={errors[`composition.${idx}.n`] ? `composition-${idx}-n-error` : undefined}
                />
                {errors[`composition.${idx}.n`] ? (
                  <p className="text-xs text-error" role="alert" id={`composition-${idx}-n-error`}>
                    {errors[`composition.${idx}.n`]}
                  </p>
                ) : null}
                {overLimit ? (
                  <p className="text-xs text-warn">
                    Bank has only {available} matching questions for this topic/level.
                  </p>
                ) : null}
              </div>

              <div className="flex items-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(idx)}>
                  Remove
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={addRow}>
          Add row
        </Button>
        {presets.map((preset) => (
          <Button
            key={preset.label}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(preset.rows)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text" htmlFor="bank-import">
          Import bank.public.v1.json (optional)
        </label>
        <Input
          id="bank-import"
          type="file"
          accept=".json"
          onChange={(e) => onFileChange(e.target.files?.[0])}
        />
        <p className="text-xs text-textMuted">File stays in your browser and is never uploaded.</p>
        {bankError ? <Alert tone="error">{bankError}</Alert> : null}
        {bankStats ? (
          <Alert tone="info">
            Loaded {bankStats.subject} bank with {bankStats.total} questions across {bankStats.topics.length} topics.
          </Alert>
        ) : null}
        <datalist id="topic-suggestions">
          {bankStats?.topics.map((topic) => (
            <option key={topic} value={topic} />
          ))}
        </datalist>
      </div>
    </Card>
  );
}
