import type { ReactNode } from 'react';

import { cn } from 'cn';

/** A legend entry: the series' mark beside text in ink, so identity never rests on color alone. */
export function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      {value === undefined ? null : <span className="font-medium tabular-nums">{value}</span>}
    </li>
  );
}

export function Legend({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-5 gap-y-2 text-sm', className)}>
      {children}
    </ul>
  );
}

export interface TooltipRow {
  color?: string;
  label: string;
  value: string;
  detail?: string;
}

/** Tooltip body: values lead and series names follow, each keyed by a short stroke of its color. */
export function TooltipCard({ title, rows }: { title: string; rows: readonly TooltipRow[] }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2.5 text-popover-foreground shadow-[0_8px_24px_rgb(0_0_0/0.16)]">
      <p className="mb-2 text-xs text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2.5 text-sm">
            {row.color ? (
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: row.color }}
                aria-hidden
              />
            ) : null}
            <span className="font-semibold tabular-nums">{row.value}</span>
            <span className="text-muted-foreground">{row.label}</span>
            {row.detail ? (
              <span className="ml-auto pl-4 text-muted-foreground tabular-nums">{row.detail}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
