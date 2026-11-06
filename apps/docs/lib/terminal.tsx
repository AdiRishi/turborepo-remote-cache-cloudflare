// The scripted terminals that the homepage animations play: what each pane prints, and when.

import type { ReactNode } from 'react';

export type Tone = 'dim' | 'ui' | 'api' | 'web' | 'ok' | 'turbo';
export type Segment = string | readonly [text: string, tone: Tone];

/** Something that happens in a pane, `at` milliseconds into the loop. */
export interface Beat<Pane extends string> {
  pane: Pane;
  at: number;
}

export interface Line<Pane extends string> extends Beat<Pane> {
  segments: readonly Segment[];
}

export interface Command<Pane extends string> extends Beat<Pane> {
  text: string;
}

export interface Script<Pane extends string> {
  commands: readonly Command<Pane>[];
  lines: readonly Line<Pane>[];
  /** When each command exits, its shell prints a fresh prompt. */
  prompts: readonly Beat<Pane>[];
}

const TYPE_MS = 45;

export const COMMAND = 'turbo run build';

/** How long typing `text` takes, so the output can start once the command is in. */
export const typingMs = (text: string) => text.length * TYPE_MS;

/** `seconds` is how long the task runs on a cache miss. */
export const TASKS = [
  {
    name: '@acme/ui',
    tone: 'ui',
    hash: '8f3c2a91d04e7b65',
    script: 'tsc -b',
    size: '412 KB',
    bytes: 412_000,
    seconds: 9.4,
  },
  {
    name: 'api',
    tone: 'api',
    hash: '2b7e9d40c1a5f3e8',
    script: 'tsup src/index.ts',
    size: '1.1 MB',
    bytes: 1_100_000,
    seconds: 21.7,
  },
  {
    name: 'web',
    tone: 'web',
    hash: 'c61f0e8a37d2b954',
    script: 'next build',
    size: '18.6 MB',
    bytes: 18_600_000,
    seconds: 48.9,
  },
] as const;

export type Task = (typeof TASKS)[number];

export const prefix = (task: Task): Segment => [`${task.name}:build: `, task.tone];

export const preamble = <Pane extends string>(pane: Pane, at: number): Line<Pane>[] =>
  [
    '• Packages in scope: @acme/ui, api, web',
    '• Running build in 3 packages',
    '• Remote caching enabled',
    '',
  ].map((text, index) => ({ pane, at: at + index * 70, segments: [[text, 'dim']] }));

export const run = <Pane extends string>(
  pane: Pane,
  at: number,
  lines: [offset: number, ...segments: Segment[]][],
): Line<Pane>[] => lines.map(([offset, ...segments]) => ({ pane, at: at + offset, segments }));

/** The last moment anything happens in `beats`. */
export const lastBeat = (beats: readonly { at: number }[]) =>
  Math.max(...beats.map((beat) => beat.at));

/** The pane whose output changed most recently, like tmux's active-pane border. */
export const activePane = <Pane extends string>(
  beats: readonly Beat<Pane>[],
  elapsed: number,
  first: Pane,
): Pane =>
  beats
    .filter((beat) => beat.at <= elapsed)
    .reduce<Beat<Pane>>((latest, beat) => (beat.at >= latest.at ? beat : latest), {
      pane: first,
      at: -1,
    }).pane;

const toneClass: Record<Tone, string> = {
  dim: 'text-[#7d838e]',
  ui: 'text-[#6cd3e6]',
  api: 'text-[#c9a2ff]',
  web: 'text-[#ff9ac1]',
  ok: 'text-[#8ee09a]',
  turbo: 'bg-linear-to-r from-[#0096ff] to-[#ff1e56] bg-clip-text font-medium text-transparent',
};

function Cursor() {
  return (
    <span className="ml-px inline-block h-[1.1em] w-[0.6em] translate-y-[0.2em] bg-[#d9dce1] motion-safe:animate-[cache-replay-blink_1s_steps(2)_infinite]" />
  );
}

/** A bordered pane with its title set into the top border. The parent sets the terminal's font and colours. */
export function Frame({
  title,
  detail,
  active,
  className = '',
  children,
}: {
  title: string;
  detail: string;
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative border transition-colors duration-300 ${
        active ? 'border-[#0096ff]/70' : 'border-[#23262c]'
      } ${className}`}
    >
      <div className="absolute top-0 left-3 z-10 -translate-y-1/2 bg-[#0e1013] px-1.5 text-[#7d838e]">
        <span className={active ? 'text-[#0096ff]' : 'text-[#d9dce1]'}>{title}</span> {detail}
      </div>
      {children}
    </div>
  );
}

/** What `pane` shows `elapsed` milliseconds into `script`: its prompt, the command as typed so far, and output. */
export function Terminal<Pane extends string>({
  script,
  pane,
  prompt,
  elapsed,
}: {
  script: Script<Pane>;
  pane: Pane;
  prompt?: string;
  elapsed: number;
}) {
  const typed = script.commands.find((entry) => entry.pane === pane);
  const visible = typed
    ? typed.text.slice(0, Math.max(0, Math.floor((elapsed - typed.at) / TYPE_MS)))
    : '';
  const typing = typed !== undefined && visible.length < typed.text.length;
  const done = script.prompts.some((entry) => entry.pane === pane && entry.at <= elapsed);
  return (
    <>
      {prompt && (
        <div>
          <span className="text-[#0096ff]">{prompt}</span> {visible}
          {typing && <Cursor />}
        </div>
      )}
      {script.lines
        .filter((line) => line.pane === pane && line.at <= elapsed)
        .map((line) => (
          <div key={line.at} className="overflow-hidden text-ellipsis whitespace-pre">
            {line.segments.map((segment) =>
              typeof segment === 'string' ? (
                segment || ' '
              ) : (
                <span key={segment[0]} className={toneClass[segment[1]]}>
                  {segment[0] || ' '}
                </span>
              ),
            )}
          </div>
        ))}
      {prompt && done && (
        <div>
          <span className="text-[#0096ff]">{prompt}</span> <Cursor />
        </div>
      )}
    </>
  );
}
