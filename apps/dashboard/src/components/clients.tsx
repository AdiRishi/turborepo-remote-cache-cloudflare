import { cn } from 'cn';

import { formatCount, formatPercent } from '@/lib/format';

import type { Share, Stats } from '../../contract';

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
  claude: 'Claude Code',
  'augment-cli': 'Augment',
  'cursor-cli': 'Cursor CLI',
  devin: 'Devin',
  replit: 'Replit',
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

/** Darker for larger shares, so the bar reads in order without a legend of hues. */
const shade = (rank: number) =>
  `color-mix(in oklab, var(--foreground) ${[78, 50, 32, 20, 12][rank] ?? 12}%, var(--background))`;

function ShareBar({
  title,
  shares,
  label,
  mono = false,
}: {
  title: string;
  shares: readonly Share[];
  label: (name: string) => string;
  /** Sets real names, such as versions and platforms, in the monospace face. */
  mono?: boolean;
}) {
  const total = shares.reduce((sum, { count }) => sum + count, 0);
  if (total === 0) {
    return null;
  }
  const shown = topShares(shares);
  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-[5.5rem_1fr]">
      <h3 className="text-sm text-muted-foreground">{title}</h3>
      <div>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {shown.map(({ name, count }, rank) => (
            <div key={name} style={{ flexGrow: count, background: shade(rank) }} />
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {shown.map(({ name, count }, rank) => (
            <li key={name} className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: shade(rank) }}
                aria-hidden
              />
              <span className={cn(mono && !GROUPS.has(name) && 'font-mono')}>
                {GROUPS.get(name) ?? label(name)}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatPercent(count / total)}
                <span className="sr-only">, {formatCount(count)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Clients({ stats }: { stats: Stats }) {
  const { ci, agents, versions, platforms } = stats.clients;
  return (
    <div className="space-y-6">
      <ShareBar title="CI" shares={ci} label={(name) => CI_NAMES[name] ?? titleCase(name)} />
      <ShareBar title="Agents" shares={agents} label={(name) => AGENT_NAMES[name] ?? name} />
      <ShareBar title="turbo" shares={versions} label={(name) => name} mono />
      <ShareBar title="Platforms" shares={platforms} label={(name) => name} mono />
    </div>
  );
}
