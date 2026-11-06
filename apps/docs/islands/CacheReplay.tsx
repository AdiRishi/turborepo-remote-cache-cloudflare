import type { Line, Script, Segment, Task } from '../lib/terminal';

import { usePlayback } from '../lib/playback';
import {
  activePane,
  COMMAND,
  Frame,
  lastBeat,
  preamble,
  prefix,
  run,
  TASKS,
  Terminal,
} from '../lib/terminal';

export const client = 'load';

type PaneId = 'laptop' | 'worker' | 'ci';

const [ui, api, web] = TASKS;

const request = (method: 'PUT' | 'GET', task: Task, status: number, detail: string): Segment[] => [
  [`${method} `, 'dim'],
  `/v8/artifacts/${task.hash}  `,
  [String(status), 'ok'],
  [`  ${detail}`, 'dim'],
];

const lines: Line<PaneId>[] = [
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

const script: Script<PaneId> = {
  commands: [
    { pane: 'laptop', at: 500, text: COMMAND },
    { pane: 'ci', at: 6600, text: COMMAND },
  ],
  lines,
  prompts: [
    { pane: 'laptop', at: 5650 },
    { pane: 'ci', at: 9100 },
  ],
};

const beats = [...script.commands, ...script.lines, ...script.prompts];

// The finished run stays on screen this long before both terminals clear and the loop starts over.
const HOLD_MS = 4500;
const LOOP = lastBeat(beats) + HOLD_MS;

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

export default function CacheReplay() {
  const { elapsed } = usePlayback(LOOP);
  const active = activePane(beats, elapsed, 'laptop');
  return (
    <figure className="not-prose mx-auto mt-12 max-w-6xl overflow-hidden rounded-xl bg-[#0e1013] font-mono text-[11px] leading-[1.7] text-[#d9dce1] shadow-[0_30px_80px_-30px_rgb(14_16_19/0.55)] ring-1 ring-black/10 sm:text-xs dark:ring-white/10">
      <figcaption className="sr-only">
        A laptop runs turbo run build. Three tasks miss the cache, run, and upload their outputs to
        the Worker, which stores them in R2. A CI runner then runs the same command, downloads all
        three artifacts, and finishes in 1.2 seconds with FULL TURBO. Then the loop starts over.
      </figcaption>
      <div aria-hidden="true" className="grid gap-x-3 gap-y-5 p-4 pt-6 lg:grid-cols-2">
        {panes.map((pane) => (
          <Frame
            key={pane.id}
            title={pane.title}
            detail={pane.detail}
            active={pane.id === active}
            className={`px-4 pt-7 pb-3 ${pane.className}`}
          >
            <Terminal script={script} pane={pane.id} prompt={pane.prompt} elapsed={elapsed} />
          </Frame>
        ))}
      </div>
    </figure>
  );
}
