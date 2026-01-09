import { Card } from "../ui/Card";
import { Switch } from "../ui/Switch";
import { Input } from "../ui/Input";

type Props = {
  autoSeed: boolean;
  seed: string;
  onAutoSeedChange: (value: boolean) => void;
  onSeedChange: (value: string) => void;
  error?: string;
};

export function SeedCard({ autoSeed, seed, onAutoSeedChange, onSeedChange, error }: Props) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text">Seed</h3>
          <p className="text-xs text-textMuted">Same seed + same bank = deterministic ordering.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-textMuted">
          <Switch id="auto-seed" checked={autoSeed} onChange={onAutoSeedChange} />
          <label htmlFor="auto-seed">Auto-generate</label>
        </div>
      </div>

      {!autoSeed ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="seed">
            Seed value
          </label>
          <Input
            id="seed"
            value={seed}
            onChange={(e) => onSeedChange(e.target.value)}
            placeholder="exam-seed-123"
            hasError={Boolean(error)}
            aria-describedby={error ? "seed-error" : undefined}
          />
          {error ? (
            <p className="text-xs text-error" role="alert" id="seed-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
