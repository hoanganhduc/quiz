import { ReactNode } from "react";
import { Button } from "./Button";
import clsx from "clsx";

type ActionBarProps = {
  show: boolean;
  children: ReactNode;
};

export function FloatingActionBar({ show, children }: ActionBarProps) {
  if (!show) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur shadow-card lg:hidden">
      <div className="mx-auto max-w-5xl px-4 py-3 flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function FloatingActionsRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("flex items-center gap-2 flex-wrap", className)}>{children}</div>;
}

export function FloatingPrimaryButton({
  disabled,
  onClick,
  children
}: {
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Button className="flex-1" variant="primary" onClick={onClick} disabled={disabled}>
      {children}
    </Button>
  );
}
