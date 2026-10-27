import { useEffect, useState } from 'react';

export const client = 'load';

type PaneId = 'laptop' | 'worker' | 'ci';
type Tone = 'dim' | 'ui' | 'api' | 'web' | 'ok' | 'turbo';
type Segment = string | readonly [text: string, tone: Tone];

interface Line {
  pane: PaneId;
  at: number;
  segments: readonly Segment[];
}

interface Command {
  pane: PaneId;
  at: number;
  text: string;
}

const TYPE_MS = 45;
const command = 'turbo run build';

const tasks = [
  { name: '@acme/ui', tone: 'ui', hash: '8f3c2a91d04e7b65', script: 'tsc -b', size: '412 KB' },
  {
    name: 'api',
    tone: 'api',
    hash: '2b7e9d40c1a5f3e8',
    script: 'tsup src/index.ts',
    size: '1.1 MB',
  },
  { name: 'web', tone: 'web', hash: 'c61f0e8a37d2b954', script: 'next build', size: '18.6 MB' },
] as const;

type Task = (typeof tasks)[number];

const [ui, api, web] = tasks;
const prefix = (task: Task): Segment => [`${task.name}:build: `, task.tone];

const preamble = (pane: PaneId, at: number): Line[] =>
  [
    '• Packages in scope: @acme/ui, api, web',
    '• Running build in 3 packages',
    '• Remote caching enabled',
    '',
  ].map((text, index) => ({ pane, at: at + index * 70, segments: [[text, 'dim']] }));

const run = (pane: PaneId, at: number, lines: [offset: number, ...segments: Segment[]][]): Line[] =>
  lines.map(([offset, ...segments]) => ({ pane, at: at + offset, segments }));

const request = (method: 'PUT' | 'GET', task: Task, status: number, detail: string): Segment[] => [
  [`${method} `, 'dim'],
  `/v8/artifacts/${task.hash}  `,
  [String(status), 'ok'],
  [`  ${detail}`, 'dim'],
];

const commands: Command[] = [
  { pane: 'laptop', at: 500, text: command },
  { pane: 'ci', at: 6600, text: command },
];

const lines: Line[] = [
  ...preamble('laptop', 1350),
  ...run('laptop', 1700, [
    [0, prefix(ui), 'cache miss, executing ', [ui.hash, 'dim']],
    [150, prefix(ui), `> ${ui.script}`],
    [1000, prefix(api), 'cache miss, executing ', [api.hash, 'dim']],
    [1080, prefix(web), 'cache miss, executing ', [web.hash, 'dim']],
    [1250, prefix(api), `> ${api.script}`],
    [1400, prefix(web), `> ${web.script}`],
    [3100, prefix(web), '✓ Compiled successfully in 31.4s'],
    [3600, ''],
    [3650, ' Tasks:    3 successful, 3 total'],
    [3700, 'Cached:    0 cached, 3 total'],
    [3750, '  Time:    48.913s'],
  ]),
  ...run('worker', 2600, [
    [0, ...request('PUT', ui, 202, `→ R2  ${ui.size}`)],
    [1700, ...request('PUT', api, 202, `→ R2  ${api.size}`)],
    [2950, ...request('PUT', web, 202, `→ R2  ${web.size}`)],
  ]),
  ...preamble('ci', 7400),
  ...run('worker', 7800, [
    [0, ...request('GET', ui, 200, `← R2  ${ui.size}`)],
    [90, ...request('GET', api, 200, `← R2  ${api.size}`)],
    [180, ...request('GET', web, 200, `← R2  ${web.size}`)],
  ]),
  ...run('ci', 7950, [
    [0, prefix(ui), 'cache hit, replaying logs ', [ui.hash, 'dim']],
    [40, prefix(ui), `> ${ui.script}`],
    [140, prefix(api), 'cache hit, replaying logs ', [api.hash, 'dim']],
    [180, prefix(api), `> ${api.script}`],
    [400, prefix(web), 'cache hit, replaying logs ', [web.hash, 'dim']],
    [440, prefix(web), `> ${web.script}`],
    [480, prefix(web), '✓ Compiled successfully in 31.4s'],
    [800, ''],
    [850, ' Tasks:    3 successful, 3 total'],
    [900, 'Cached:    3 cached, 3 total'],
    [950, '  Time:    1.204s ', ['>>> FULL TURBO', 'turbo']],
  ]),
];

const END = Math.max(...lines.map((line) => line.at)) + 200;

const toneClass: Record<Tone, string> = {
  dim: 'text-[#7d838e]',
  ui: 'text-[#6cd3e6]',
  api: 'text-[#c9a2ff]',
  web: 'text-[#ff9ac1]',
  ok: 'text-[#8ee09a]',
  turbo: 'font-medium text-[#ffb224]',
};

const panes: { id: PaneId; title: string; detail: string; prompt?: string; className: string }[] = [
  { id: 'laptop', title: 'laptop', detail: '~/acme', prompt: '~/acme $', className: 'h-[23.5rem]' },
  {
    id: 'worker',
    title: 'worker',
    detail: 'wrangler tail',
    className: 'h-[10rem] lg:col-span-2 lg:row-start-2',
  },
  { id: 'ci', title: 'ci', detail: 'github actions', prompt: 'runner $', className: 'h-[23.5rem]' },
];

// The pane whose output changed most recently, like tmux's active-pane border.
const activePane = (elapsed: number): PaneId => {
  const events = [...commands, ...lines].filter((event) => event.at <= elapsed);
  return events.reduce<{ pane: PaneId; at: number }>(
    (latest, event) => (event.at >= latest.at ? event : latest),
    {
      pane: 'laptop',
      at: -1,
    },
  ).pane;
};

const usePlayback = () => {
  const [elapsed, setElapsed] = useState(0);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setElapsed(END);
      return undefined;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const next = Math.min(now - start, END);
      setElapsed(next);
      if (next < END) {
        frame = requestAnimationFrame(tick);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [round]);

  const replay = () => {
    setRound((count) => count + 1);
  };

  return { elapsed, done: elapsed >= END, replay };
};

function Prompt({ prompt, pane, elapsed }: { prompt: string; pane: PaneId; elapsed: number }) {
  const typed = commands.find((entry) => entry.pane === pane);
  const visible = typed
    ? typed.text.slice(0, Math.max(0, Math.floor((elapsed - typed.at) / TYPE_MS)))
    : '';
  const typing = typed !== undefined && visible.length < typed.text.length;
  return (
    <div>
      <span className="text-[#ffb224]">{prompt}</span> {visible}
      {typing && (
        <span className="ml-px inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-[#d9dce1] motion-safe:animate-[cache-replay-blink_1s_steps(2)_infinite]" />
      )}
    </div>
  );
}

function Pane({
  pane,
  elapsed,
  active,
}: {
  pane: (typeof panes)[number];
  elapsed: number;
  active: boolean;
}) {
  return (
    <div
      className={`relative border px-4 pt-7 pb-3 transition-colors duration-300 ${
        active ? 'border-[#ffb224]/70' : 'border-[#23262c]'
      } ${pane.className}`}
    >
      <div className="absolute top-0 left-3 -translate-y-1/2 bg-[#0e1013] px-1.5 text-[#7d838e]">
        <span className={active ? 'text-[#ffb224]' : 'text-[#d9dce1]'}>{pane.title}</span>{' '}
        {pane.detail}
      </div>
      {pane.prompt && <Prompt prompt={pane.prompt} pane={pane.id} elapsed={elapsed} />}
      {lines
        .filter((line) => line.pane === pane.id && line.at <= elapsed)
        .map((line) => (
          <div key={line.at} className="overflow-hidden text-ellipsis whitespace-pre">
            {line.segments.map((segment) =>
              typeof segment === 'string' ? (
                segment || ' '
              ) : (
                <span key={segment[0]} className={toneClass[segment[1]]}>
                  {segment[0] || ' '}
                </span>
              ),
            )}
          </div>
        ))}
    </div>
  );
}

export default function CacheReplay() {
  const { elapsed, done, replay } = usePlayback();
  const active = activePane(elapsed);
  return (
    <figure className="not-prose mx-auto mt-12 max-w-6xl overflow-hidden rounded-xl bg-[#0e1013] font-mono text-[11px] leading-[1.7] text-[#d9dce1] shadow-[0_30px_80px_-30px_rgb(14_16_19/0.55)] ring-1 ring-black/10 sm:text-xs dark:ring-white/10">
      <figcaption className="sr-only">
        A laptop runs turbo run build. Three tasks miss the cache, run, and upload their outputs to
        the Worker, which stores them in R2. A CI runner then runs the same command, downloads all
        three artifacts, and finishes in 1.2 seconds with FULL TURBO.
      </figcaption>
      <div aria-hidden="true" className="grid gap-x-3 gap-y-5 p-4 pt-6 lg:grid-cols-2">
        {panes.map((pane) => (
          <Pane key={pane.id} pane={pane} elapsed={elapsed} active={pane.id === active} />
        ))}
      </div>
      <div className="flex items-center justify-between bg-[#ffb224] px-3 py-1 text-[#1a1405]">
        <span aria-hidden="true">[acme] 0:turbo*</span>
        <button
          type="button"
          onClick={replay}
          disabled={!done}
          className="rounded-sm px-1.5 font-medium underline-offset-2 hover:underline focus-visible:outline-[#1a1405] disabled:invisible"
        >
          Replay
        </button>
      </div>
    </figure>
  );
}
