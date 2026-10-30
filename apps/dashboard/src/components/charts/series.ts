/** Paints for the chart series. They resolve CSS variables, so a theme change needs no new definition. */
export const SERIES = {
  remote: { label: 'This server', color: 'var(--remote)' },
  local: { label: 'Local caches', color: 'var(--local)' },
} as const;

export type SeriesName = keyof typeof SERIES;
