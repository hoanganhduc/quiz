import { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
};

const variantClasses: Record<Variant, string> = {
  primary: "bg-info text-white hover:bg-info/90 shadow-sm",
  secondary: "bg-muted text-text hover:bg-muted/80",
  ghost: "bg-transparent hover:bg-muted text-text",
  danger: "bg-error text-white hover:bg-error/90"
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm"
};

export function Button({ variant = "primary", size = "md", icon, children, className, ...rest }: Props) {
  return (
    <button
      className={clsx(
        "rounded-lg border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        "inline-flex items-center gap-2 justify-center",
        className
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
