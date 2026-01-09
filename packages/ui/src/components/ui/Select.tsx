import { SelectHTMLAttributes } from "react";
import clsx from "clsx";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export function Select({ hasError = false, className, children, ...rest }: Props) {
  return (
    <select
      className={clsx(
        "w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900",
        "disabled:cursor-not-allowed disabled:opacity-60",
        hasError ? "border-error" : "border-border",
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
