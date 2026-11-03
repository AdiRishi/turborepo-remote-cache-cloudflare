// Tasks, beats, and loop position for the cache flow animation.

// Each round builds one task on the laptop and replays it in CI, so the account fills up as it loops.
export const TASKS = [
  {
    name: 'web',
    hash: 'c61f0e8a',
    tone: 'text-[#ff9ac1]',
    bar: 'bg-[#ff9ac1]',
    built: 48.9,
    replayed: 1.2,
    mb: 18.6,
  },
  {
    name: 'api',
    hash: '2b7e9d40',
    tone: 'text-[#c9a2ff]',
    bar: 'bg-[#c9a2ff]',
    built: 21.7,
    replayed: 0.6,
    mb: 1.1,
  },
  {
    name: 'ui',
    hash: '8f3c2a91',
    tone: 'text-[#6cd3e6]',
    bar: 'bg-[#6cd3e6]',
    built: 9.4,
    replayed: 0.3,
    mb: 0.4,
  },
] as const;

export type Task = (typeof TASKS)[number];

// Milliseconds into a round at which each beat lands.
export const at = {
  laptopCommand: 200,
  laptopMiss: 500,
  built: 2300,
  uploaded: 3100,
  ciCommand: 3600,
  requested: 3900,
  downloaded: 4700,
  fullTurbo: 5100,
  counted: 5500,
} as const;

const ROUND = at.counted + 900;
// After the last round, the full account stays on screen for a moment before it empties and starts over.
export const LOOP = TASKS.length * ROUND + 2000;

export const total = (tasks: readonly Task[], key: 'built' | 'mb') =>
  tasks.reduce((sum, task) => sum + task[key], 0);

export type Box = 'laptop' | 'account' | 'ci';

// The box that changed most recently gets the highlight, like the active pane in tmux.
const focus: readonly (readonly [moment: number, box: Box])[] = [
  [0, 'laptop'],
  [at.built, 'account'],
  [at.ciCommand, 'ci'],
  [at.requested, 'account'],
  [at.downloaded, 'ci'],
  [at.counted, 'account'],
];

const activeBox = (elapsed: number): Box =>
  focus.findLast(([moment]) => moment <= elapsed)?.[1] ?? 'laptop';

/** Progress from 0 to 1 between two moments, clamped at both ends. */
export const progress = (elapsed: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (elapsed - from) / (to - from)));

/** Where the loop is: which task is in flight, and how far into its round. */
export interface Moment {
  task: Task;
  round: number;
  local: number;
  active: Box;
}

export const momentAt = (elapsed: number): Moment => {
  const round = Math.min(TASKS.length - 1, Math.floor(elapsed / ROUND));
  const local = elapsed - round * ROUND;
  return { task: TASKS[round] ?? TASKS[0], round, local, active: activeBox(local) };
};
