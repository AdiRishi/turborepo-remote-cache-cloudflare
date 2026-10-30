import type { ErrorComponentProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { useQueryErrorResetBoundary, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import * as v from 'valibot';

import { Dashboard } from '@/components/dashboard';
import { SiteHeader } from '@/components/site-header';
import { LoadError, Loading, NoActivity, StatsDisabled } from '@/components/states';
import { formatAge } from '@/lib/format';
import { statsQuery } from '@/lib/stats';

import { STATS_RANGES } from '../../contract';

const SearchParams = v.object({
  range: v.optional(v.fallback(v.picklist(STATS_RANGES), '30d'), '30d'),
});

export const Route = createFileRoute('/')({
  validateSearch: SearchParams,
  loaderDeps: ({ search }) => ({ range: search.range }),
  loader: ({ context, deps }) =>
    context.queryClient.query({ ...statsQuery(deps.range), staleTime: 'static' }),
  component: DashboardPage,
  // The prerendered shell shows this until the first stats arrive, so it must not depend on them.
  pendingComponent: PendingPage,
  errorComponent: ErrorPage,
});

function PageFrame({ footer, children }: { footer?: ReactNode; children: ReactNode }) {
  const { range } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div className="min-h-dvh">
      <SiteHeader
        range={range}
        onRangeChange={(next) => {
          void navigate({ search: { range: next } });
        }}
      />
      <main className="mx-auto max-w-6xl px-5 sm:px-8">{children}</main>
      {footer ? (
        <footer className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="border-t py-8 text-sm text-muted-foreground">{footer}</p>
        </footer>
      ) : null}
    </div>
  );
}

function DashboardPage() {
  const { range } = Route.useSearch();
  const { data } = useSuspenseQuery(statsQuery(range));
  if (!data.enabled) {
    return (
      <PageFrame>
        <StatsDisabled />
      </PageFrame>
    );
  }
  return (
    <PageFrame footer={`Updated ${formatAge(data.generatedAt)}. The page refreshes every minute.`}>
      {data.allTime.since === null ? <NoActivity /> : <Dashboard stats={data} />}
    </PageFrame>
  );
}

function PendingPage() {
  return (
    <PageFrame>
      <Loading />
    </PageFrame>
  );
}

function ErrorPage({ error }: ErrorComponentProps) {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();
  // A retry re-runs the loader, whose query must not replay the cached error.
  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);
  return (
    <PageFrame>
      <LoadError
        error={error}
        onRetry={() => {
          void router.invalidate();
        }}
      />
    </PageFrame>
  );
}
