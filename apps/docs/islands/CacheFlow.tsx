import type { ReactNode } from 'react';

import type { Moment } from '../lib/cache-flow';

import { LOOP, TASKS, at, momentAt, progress, total } from '../lib/cache-flow';
import { usePlayback, useSeen } from '../lib/playback';

export const client = 'visible';

function Card({
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
      className={`relative rounded-lg border px-3 pt-4 pb-2.5 transition-colors duration-300 ${
        active ? 'border-[#ffb224]/70' : 'border-[#23262c]'
      } ${className}`}
    >
      <div className="absolute top-0 left-2.5 -translate-y-1/2 bg-[#0e1013] px-1.5 text-[#7d838e]">
        <span className={active ? 'text-[#ffb224]' : 'text-[#d9dce1]'}>{title}</span> {detail}
      </div>
      {children}
    </div>
  );
}

function Line({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <div
      className={`overflow-hidden text-ellipsis whitespace-nowrap transition-opacity duration-300 ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {children}
    </div>
  );
}

/**
 * A vertical wire with the artifact riding it while `share` runs from 0 to 1. Phones stack every box, so
 * the artifact always travels down. From `sm` up, `up` sends it from the account below to the box above.
 */
function Wire({
  share,
  label,
  hash,
  up = false,
  className = '',
}: {
  share: number;
  label: string;
  hash: string;
  up?: boolean;
  className?: string;
}) {
  const moving = share > 0 && share < 1;
  const chip = (top: number, visibility: string) => (
    <span
      className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[#ffb224] px-1 text-[10px] leading-4 font-medium text-[#1a1405] shadow-[0_0_12px_rgb(255_178_36/0.6)] ${visibility}`}
      style={{ top: `${top * 100}%` }}
    >
      {hash}
    </span>
  );
  return (
    <div className={`relative flex h-14 justify-center ${className}`}>
      <div className="h-full w-px bg-[#23262c]" />
      <span className="absolute top-1/2 left-1/2 ml-3 -translate-y-1/2 text-[10px] text-[#7d838e]">
        {label}
      </span>
      {moving && up ? (
        <>
          {chip(share, 'sm:hidden')}
          {chip(1 - share, 'hidden sm:block')}
        </>
      ) : null}
      {moving && !up ? chip(share, '') : null}
    </div>
  );
}

const reached = (local: number) => (moment: number) => local >= moment;

function Laptop({ task, local, active }: Moment) {
  const after = reached(local);
  return (
    <Card
      title="laptop"
      detail="~/acme"
      active={active === 'laptop'}
      className="min-h-[7.5rem] sm:col-start-1 sm:row-start-1"
    >
      <Line show={after(at.laptopCommand)}>
        <span className="text-[#ffb224]">$</span> turbo run build
      </Line>
      <Line show={after(at.laptopMiss)}>
        <span className={task.tone}>{task.name}:build</span> cache miss, executing
      </Line>
      <div
        className={`my-1.5 h-1 overflow-hidden rounded-full bg-[#23262c] transition-opacity ${
          after(at.laptopMiss) ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className={`h-full ${task.bar}`}
          style={{ width: `${progress(local, at.laptopMiss, at.built) * 100}%` }}
        />
      </div>
      <Line show={after(at.built)}>
        <span className="text-[#8ee09a]">✓</span> built in {task.built}s, uploading {task.hash}
      </Line>
    </Card>
  );
}

function Account({ task, round, local, active }: Moment) {
  const after = reached(local);
  const stored = TASKS.slice(0, after(at.uploaded) ? round + 1 : round);
  const replayed = TASKS.slice(0, after(at.counted) ? round + 1 : round);
  return (
    <div className="relative rounded-lg border border-dashed border-[#ffb224]/40 px-2.5 pt-6 pb-2.5 sm:col-span-2 sm:row-start-3">
      <div className="absolute top-0 left-3 -translate-y-1/2 bg-[#0e1013] px-1.5 text-[#ffb224]">
        your cloudflare account
      </div>
      <div className="grid gap-x-2 gap-y-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Card title="worker" detail="/v8/artifacts" active={active === 'account'}>
          <Line show={after(at.uploaded)}>
            <span className="text-[#7d838e]">PUT</span> {task.hash}{' '}
            <span className="text-[#8ee09a]">202</span>
            <span className="text-[#7d838e]"> → R2</span>
          </Line>
          <Line show={after(at.requested)}>
            <span className="text-[#7d838e]">GET</span> {task.hash}{' '}
            <span className="text-[#8ee09a]">200</span>
            <span className="text-[#7d838e]"> ← R2</span>
          </Line>
        </Card>
        <Card title="r2" detail="artifacts" active={false}>
          <div className={stored.length > 0 ? 'text-[#d9dce1]' : 'text-[#7d838e]'}>
            {stored.length > 0 ? `${stored.length} stored` : 'empty'}
          </div>
          <div className="text-[#7d838e]">{total(stored, 'mb').toFixed(1)} MB</div>
        </Card>
        <Card title="d1" detail="stats" active={false}>
          <div className={replayed.length > 0 ? 'text-[#ffb224]' : 'text-[#7d838e]'}>
            {total(replayed, 'built').toFixed(1)}s saved
          </div>
          <div className="text-[#7d838e]">
            {replayed.length === 1 ? '1 remote hit' : `${replayed.length} remote hits`}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Ci({ task, local, active }: Moment) {
  const after = reached(local);
  return (
    <Card
      title="ci"
      detail="github actions"
      active={active === 'ci'}
      className="min-h-[7.5rem] sm:col-start-2 sm:row-start-1"
    >
      <Line show={after(at.ciCommand)}>
        <span className="text-[#ffb224]">$</span> turbo run build
      </Line>
      <Line show={after(at.downloaded)}>
        <span className={task.tone}>{task.name}:build</span> cache hit, replaying logs
      </Line>
      <Line show={after(at.fullTurbo)}>
        <span className="text-[#8ee09a]">✓</span> built in {task.built}s
      </Line>
      <Line show={after(at.fullTurbo)}>
        Time: {task.replayed}s{' '}
        <span className="font-medium text-[#ffb224]">&gt;&gt;&gt; FULL TURBO</span>
      </Line>
    </Card>
  );
}

export default function CacheFlow() {
  const { ref, seen } = useSeen<HTMLElement>();
  const { elapsed } = usePlayback(LOOP, { playing: seen, loop: true });
  const moment = momentAt(elapsed);
  return (
    <figure
      ref={ref}
      className="not-prose my-8 overflow-hidden rounded-xl bg-[#0e1013] font-mono text-[11px] leading-[1.7] text-[#d9dce1] shadow-[0_30px_80px_-30px_rgb(14_16_19/0.55)] ring-1 ring-black/10 sm:text-xs dark:ring-white/10"
    >
      <figcaption className="sr-only">
        A looping animation. A laptop runs turbo run build. A task misses the cache, builds, and
        uploads its artifact to a Worker in your Cloudflare account, which stores it in R2. A CI
        runner then runs the same build, downloads the artifact, and finishes in about a second with
        FULL TURBO, and the stats database adds the time it saved. The loop repeats for the web,
        api, and ui packages, then starts over.
      </figcaption>
      <div aria-hidden="true" className="flex flex-col p-4 pt-6 sm:grid sm:grid-cols-2 sm:gap-x-4">
        <Laptop {...moment} />
        <Wire
          share={progress(moment.local, at.built, at.uploaded)}
          label="PUT"
          hash={moment.task.hash}
          className="sm:col-start-1 sm:row-start-2"
        />
        <Account {...moment} />
        <Wire
          share={progress(moment.local, at.requested, at.downloaded)}
          label="GET"
          hash={moment.task.hash}
          up
          className="sm:col-start-2 sm:row-start-2"
        />
        <Ci {...moment} />
      </div>
      <div aria-hidden="true" className="bg-[#ffb224] px-3 py-1 text-[#1a1405]">
        built once, replayed everywhere
      </div>
    </figure>
  );
}
