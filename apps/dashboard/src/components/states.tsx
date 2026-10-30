import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const DOCS_URL = 'https://turborepo-remote-cache.dev/dashboard';

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="max-w-[60ch] py-20 sm:py-28">
      <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.045em]">
        {title}
      </h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

export function StatsDisabled() {
  return (
    <Notice title="Usage stats are off">
      <p>
        This server records cache activity in a database, and it hasn't found one. On Cloudflare,
        bind a D1 database as <Code>STATS_DB</Code>. On other platforms, configure Nitro's{' '}
        <Code>database</Code> option. The cache works the same either way.
      </p>
      <p>
        <a href={DOCS_URL} className="font-medium text-foreground underline underline-offset-4">
          Set up the dashboard
        </a>
      </p>
    </Notice>
  );
}

export function NoActivity() {
  const origin = typeof window === 'undefined' ? 'https://your-server' : window.location.origin;
  return (
    <Notice title="No cache activity yet">
      <p>
        Stats appear after <Code>turbo</Code> uses this server. Point it here with your token and
        team, then run any task:
      </p>
      <pre className="overflow-x-auto rounded-lg border bg-muted p-4 font-mono text-sm leading-relaxed text-foreground">
        {`TURBO_API=${origin} \\
TURBO_TOKEN=<your token> \\
TURBO_TEAM=team_example \\
turbo run build`}
      </pre>
      <p>
        <a
          href="https://turborepo-remote-cache.dev/connect-turbo"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Connect turbo
        </a>
      </p>
    </Notice>
  );
}

export function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Notice title="The stats didn't load">
      <p>
        {error instanceof Error ? error.message : 'The stats request failed'}. The cache keeps
        working while the stats are unavailable.
      </p>
      <p>
        <Button variant="outline" onClick={onRetry}>
          Load the stats again
        </Button>
      </p>
    </Notice>
  );
}

export function Loading() {
  return (
    <div className="pt-6 pb-14" aria-busy="true" aria-label="Loading stats">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="mt-4 h-4 w-56" />
      <Skeleton className="mt-20 h-32 w-[min(30rem,80%)]" />
      <Skeleton className="mt-16 h-2 w-full" />
      <Skeleton className="mt-6 h-24 w-full" />
    </div>
  );
}
