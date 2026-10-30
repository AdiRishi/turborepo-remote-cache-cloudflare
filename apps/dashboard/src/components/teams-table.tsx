import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp } from 'lucide-react';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatBytes, formatCount, formatDuration, formatPercent } from '@/lib/format';
import { hitRate, tasks, timeSaved } from '@/lib/stats';

import type { TeamActivity } from '../../contract';

import { Sparkline } from './charts/sparkline';

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
});

const column = createColumnHelper<typeof features, TeamActivity>();

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

const numeric = { sortFn: 'basic', sortDescFirst: true } as const;

const columns = column.columns([
  column.accessor('team', {
    header: 'Team',
    sortFn: 'alphanumeric',
    cell: (info) => <span className="font-mono">{info.getValue()}</span>,
  }),
  column.accessor('runs', {
    header: 'Runs',
    ...numeric,
    cell: (info) => formatCount(info.getValue()),
  }),
  column.accessor((team) => hitRate(team) ?? -1, {
    id: 'hitRate',
    header: 'Hit rate',
    ...numeric,
    cell: (info) => {
      const rate = hitRate(info.row.original);
      return rate === null ? (
        <span className="text-muted-foreground">–</span>
      ) : (
        <span title={`${formatCount(tasks(info.row.original))} tasks`}>{formatPercent(rate)}</span>
      );
    },
  }),
  column.display({
    id: 'trend',
    header: () => <span className="sr-only">Time saved over the range</span>,
    cell: (info) => (
      <Sparkline
        values={info.row.original.timeSavedSeries}
        className="ml-auto h-5 w-24 text-muted-foreground"
      />
    ),
  }),
  column.accessor((team) => timeSaved(team), {
    id: 'timeSaved',
    header: 'Time saved',
    ...numeric,
    cell: (info) => formatDuration(info.getValue()),
  }),
  column.accessor('storedBytes', {
    header: 'Stored',
    ...numeric,
    cell: (info) => formatBytes(info.getValue()),
  }),
  column.accessor('downloadedBytes', {
    header: 'Downloaded',
    ...numeric,
    cell: (info) => formatBytes(info.getValue()),
  }),
]);

export function TeamsTable({ teams }: { teams: readonly TeamActivity[] }) {
  const table = useTable({
    features,
    columns,
    data: teams,
    initialState: { sorting: [{ id: 'timeSaved', desc: true }] },
  });

  return (
    <section>
      <h2 className="mb-2 font-medium">Teams</h2>
      <Table className="min-w-[720px] tabular-nums">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    className="px-0 first:pl-0 [&:not(:first-child)]:text-right"
                    aria-sort={
                      header.column.getCanSort() ? (sorted ? ARIA_SORT[sorted] : 'none') : undefined
                    }
                  >
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 rounded-sm font-normal text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                      >
                        <table.FlexRender header={header} />
                        {sorted === 'asc' ? <ArrowUp className="size-3.5" /> : null}
                        {sorted === 'desc' ? <ArrowDown className="size-3.5" /> : null}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              // Rows glide to their new order when the range changes.
              style={{ viewTransitionName: CSS.escape(`team-${row.original.team}`) }}
            >
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className="px-0 py-3 first:pl-0 [&:not(:first-child)]:pl-4 [&:not(:first-child)]:text-right"
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
