/** Paints for the chart series. They resolve CSS variables, so a theme change needs no new definition. */
export const SERIES = {
  remote: { label: 'Remote cache', color: 'var(--remote)' },
  local: { label: 'Local cache', color: 'var(--local)' },
  ran: { label: 'Ran the task', color: 'var(--miss)' },
} as const;

export type SeriesName = keyof typeof SERIES;

/** Measures that are not cache activity, such as storage, use one neutral ink. */
export const NEUTRAL = 'var(--neutral)';

/** Hairline grid styling shared by every chart. */
export const GRID = { stroke: 'var(--grid)', strokeWidth: 1 } as const;
