import type { ExamPolicyV1 } from "@app/shared";
import { Accordion } from "../ui/Accordion";
import { Select } from "../ui/Select";
import { Switch } from "../ui/Switch";
import { Input } from "../ui/Input";

type Props = {
  policy: ExamPolicyV1;
  onChange: (next: ExamPolicyV1) => void;
  errors?: Record<string, string>;
};

export function PolicyCard({ policy, onChange, errors = {} }: Props) {
  return (
    <Accordion title="Policy" defaultOpen tone="muted">
      <div className="space-y-3">
        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="auth-mode">
            Auth mode
          </label>
          <Select
            id="auth-mode"
            value={policy.authMode}
            hasError={Boolean(errors["policy.authMode"])}
            onChange={(e) => onChange({ ...policy, authMode: e.target.value as ExamPolicyV1["authMode"] })}
          >
            <option value="required">Required</option>
            <option value="optional">Optional</option>
            <option value="none">None</option>
          </Select>
          {errors["policy.authMode"] ? (
            <p className="text-xs text-error" role="alert">
              {errors["policy.authMode"]}
            </p>
          ) : (
            <p className="text-xs text-textMuted">Required means students must sign in; optional allows anonymous.</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">Require view code</p>
            <p className="text-xs text-textMuted">Students must enter a code to load questions.</p>
          </div>
          <Switch
            id="require-view-code"
            checked={policy.requireViewCode}
            onChange={(value) => onChange({ ...policy, requireViewCode: value })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text">Require submit code</p>
            <p className="text-xs text-textMuted">Students must enter a code to submit answers.</p>
          </div>
          <Switch
            id="require-submit-code"
            checked={policy.requireSubmitCode}
            onChange={(value) => onChange({ ...policy, requireSubmitCode: value })}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="solutions-mode">
            Solutions mode
          </label>
          <Select
            id="solutions-mode"
            value={policy.solutionsMode}
            hasError={Boolean(errors["policy.solutionsMode"])}
            onChange={(e) =>
              onChange({ ...policy, solutionsMode: e.target.value as ExamPolicyV1["solutionsMode"] })
            }
          >
            <option value="never">Never</option>
            <option value="after_submit">After submit</option>
            <option value="always">Always</option>
          </Select>
          {errors["policy.solutionsMode"] ? (
            <p className="text-xs text-error" role="alert">
              {errors["policy.solutionsMode"]}
            </p>
          ) : (
            <p className="text-xs text-textMuted">Controls when answer keys and solutions become visible.</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="time-limit-minutes">
            Time limit (minutes)
          </label>
          <Input
            id="time-limit-minutes"
            type="number"
            value={policy.timeLimitMinutes ?? ""}
            onChange={(e) =>
              onChange({
                ...policy,
                timeLimitMinutes: e.target.value ? Number(e.target.value) : undefined
              })
            }
            placeholder="Optional"
            hasError={Boolean(errors["policy.timeLimitMinutes"])}
          />
          {errors["policy.timeLimitMinutes"] ? (
            <p className="text-xs text-error" role="alert">
              {errors["policy.timeLimitMinutes"]}
            </p>
          ) : (
            <p className="text-xs text-textMuted">Leave blank for no time limit.</p>
          )}
        </div>
      </div>
    </Accordion>
  );
}
