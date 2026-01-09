import { TextareaHTMLAttributes } from "react";
import clsx from "clsx";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export function Textarea({ hasError = false, className, ...rest }: Props) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-lg border bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
        "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900",
        "disabled:cursor-not-allowed disabled:opacity-60",
        hasError ? "border-error" : "border-border",
        className
      )}
      {...rest}
    />
  );
}
