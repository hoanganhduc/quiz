import clsx from "clsx";

type Props = {
  id?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export function Switch({ id, checked, onChange, disabled = false }: Props) {
  return (
    <span className="relative inline-flex h-6 w-11 items-center">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={clsx(
          "peer absolute inset-0 z-10 h-full w-full opacity-0",
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
      />
      <span
        className={clsx(
          "h-6 w-11 rounded-full border transition-colors",
          "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-neutral-900",
          checked ? "bg-indigo-600 border-indigo-600" : "bg-neutral-200 dark:bg-neutral-800 border-border",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        )}
      />
      <span
        className={clsx(
          "pointer-events-none absolute left-1 top-0.5 h-5 w-5 rounded-full bg-white dark:bg-neutral-100 shadow transition-transform",
          "peer-checked:translate-x-5"
        )}
      />
    </span>
  );
}
