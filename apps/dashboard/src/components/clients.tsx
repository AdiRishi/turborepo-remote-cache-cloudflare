import { cn } from 'cn';

import { formatCount, formatPercent } from '@/lib/format';

import type { Share, Stats } from '../../contract';

import { Section } from './chart-parts';

const SHOWN = 5;

// Rows that group several sources rather than naming one. The server reports requests without a
// `turbo` User-Agent as `unknown`.
const GROUPS = new Map([
  ['Other', 'Other'],
  ['unknown', 'Other clients'],
]);

// `turbo` reports CI providers by constant name. Title case covers the rest, such as `AZURE_PIPELINES`.
const CI_NAMES: Record<string, string> = {
  local: 'Not in CI',
  GITHUB_ACTIONS: 'GitHub Actions',
  GITLAB: 'GitLab CI',
  CIRCLE: 'CircleCI',
  CODEBUILD: 'AWS CodeBuild',
  TEAMCITY: 'TeamCity',
};

const AGENT_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
  'github-copilot': 'GitHub Copilot',
  copilot: 'GitHub Copilot',
  gemini: 'Gemini CLI',
  opencode: 'opencode',
};

const titleCase = (name: string) =>
  name
    .toLowerCase()
    .split(/[_-]/u)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** Keeps the largest shares and folds the rest into one "Other" row. */
const topShares = (shares: readonly Share[]) => {
  if (shares.length <= SHOWN) {
    return shares;
  }
  const rest = shares.slice(SHOWN - 1).reduce((sum, { count }) => sum + count, 0);
  return [...shares.slice(0, SHOWN - 1), { name: 'Other', count: rest }];
};

function ShareList({
  title,
  description,
  shares,
  label,
  mono = false,
}: {
  title: string;
  description: string;
  shares: readonly Share[];
  label: (name: string) => string;
  /** Sets real names, such as versions and platforms, in the monospace face. */
  mono?: boolean;
}) {
  const total = shares.reduce((sum, { count }) => sum + count, 0);
  return (
    <div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      {total === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">Nothing reported in this period.</p>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {topShares(shares).map(({ name, count }) => (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span
                  className={cn('truncate', mono && !GROUPS.has(name) && 'font-mono text-[13px]')}
                >
                  {GROUPS.get(name) ?? label(name)}
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatPercent(count / total)}
                  <span className="sr-only">, {formatCount(count)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-grid">
                <div
                  className="h-full rounded-full bg-[var(--neutral)]"
                  style={{ width: `${Math.max(1.5, (count / total) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Clients({ stats }: { stats: Stats }) {
  const { ci, agents, versions, platforms } = stats.clients;
  return (
    <Section
      title="Clients"
      description="Where runs come from, and the turbo builds that move artifacts."
    >
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        <ShareList
          title="CI providers"
          description="Share of runs"
          shares={ci}
          label={(name) => CI_NAMES[name] ?? titleCase(name)}
        />
        <ShareList
          title="Coding agents"
          description="Runs an AI agent started"
          shares={agents}
          label={(name) => AGENT_NAMES[name] ?? name}
        />
        <ShareList
          title="turbo versions"
          description="Share of artifact requests"
          shares={versions}
          label={(name) => name}
          mono
        />
        <ShareList
          title="Platforms"
          description="Share of artifact requests"
          shares={platforms}
          label={(name) => name}
          mono
        />
      </div>
    </Section>
  );
}
