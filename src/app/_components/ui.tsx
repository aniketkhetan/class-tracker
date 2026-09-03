import type { ReactNode } from "react";

export function Card({
  title,
  action,
  className = "",
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          {title && (
            <h2 className="text-sm font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
      {children}
    </p>
  );
}

const base =
  "rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50";

export const buttonStyles = {
  primary: `${base} bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200`,
  confirm: `${base} bg-emerald-600 text-white hover:bg-emerald-500`,
  reject: `${base} border border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800`,
  quiet: `${base} text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100`,
};

export const inputStyles =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-300";
