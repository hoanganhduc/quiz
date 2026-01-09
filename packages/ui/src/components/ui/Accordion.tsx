import { ReactNode, useState } from "react";
import clsx from "clsx";
import { Button } from "./Button";

type Props = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: "info" | "warn" | "error" | "success" | "muted";
};

const toneBorder: Record<NonNullable<Props["tone"]>, string> = {
  info: "border-info/30",
  warn: "border-warn/30",
  error: "border-error/30",
  success: "border-success/30",
  muted: "border-border"
};

export function Accordion({ title, children, defaultOpen = false, tone = "muted" }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={clsx("rounded-xl border bg-card shadow-sm", toneBorder[tone])}>
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="font-medium text-sm">{title}</h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Show"}
        </Button>
      </div>
      {open ? <div className="px-4 pb-4 text-sm space-y-3">{children}</div> : null}
    </div>
  );
}
