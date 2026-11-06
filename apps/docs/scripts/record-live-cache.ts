// Records the LiveCache island to the GIF at the top of the README. It needs ffmpeg on the PATH.
//
// Playwright's fake clock drives the page, so every frame lands at an exact moment and the GIF loops without
// a seam. The clock covers timers and requestAnimationFrame but not CSS animations, so each frame also sets
// every CSS animation to the same moment.

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 4321;
const PAGE = `http://localhost:${PORT}/turborepo-remote-cache-cloudflare/live-cache`;
const OUTPUT = join(import.meta.dirname, '../../../.github/assets/live-cache.gif');

const FPS = 25;
const FRAME_MS = 1000 / FPS;
// The figure's full width in CSS pixels, at which it stops growing.
const WIDTH = 1040;
// Captured at twice the size and scaled down, so text stays sharp on high-density screens.
const CAPTURE_SCALE = 2;
const OUTPUT_SCALE = 1.5;

const answers = async () => {
  try {
    return (await fetch(PAGE)).ok;
  } catch {
    return false;
  }
};

// Astro moves to the next free port when this one is taken, so a server already here would be recorded instead.
if (await answers()) {
  throw new Error(`Something already answers on port ${PORT}. Stop it and run this again.`);
}

const server = spawn('pnpm', ['exec', 'blume', 'dev', '--port', String(PORT)], {
  cwd: join(import.meta.dirname, '..'),
  stdio: 'ignore',
  // Its own process group, so stopping the group also stops the server that pnpm starts.
  detached: true,
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await answers()) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`${PAGE} did not answer within a minute`);
};

const frames = await mkdtemp(join(tmpdir(), 'live-cache-'));
const browser = await chromium.launch();

try {
  await waitForServer();
  // A fresh development server reloads the page once after the first visit, while it prepares dependencies.
  // This visit takes that reload, so the recording's page loads only once.
  const warmup = await browser.newPage();
  await warmup.goto(PAGE, { waitUntil: 'networkidle' });
  await warmup.locator('[data-dashboard] > *').waitFor();
  await warmup.waitForLoadState('networkidle');
  await warmup.close();

  const page = await browser.newPage({
    viewport: { width: WIDTH + 160, height: 1000 },
    deviceScaleFactor: CAPTURE_SCALE,
    colorScheme: 'dark',
    timezoneId: 'America/Los_Angeles',
  });
  // 9:20 in the morning in Los Angeles, before the sample team's first build, so the CI run adds the day's
  // first bar to the chart.
  const start = Date.UTC(2026, 10, 3, 17, 20);
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start + 1000);
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.locator('astro-island:not([ssr])').waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Square corners and no shadow for the GIF. The selector outranks the island's own classes, which the
  // development server injects after this rule.
  await page.addStyleTag({
    content: 'figure[data-live-cache] { border-radius: 0; box-shadow: none; }',
  });

  const figure = page.locator('[data-live-cache]');
  const loop = Number(await figure.getAttribute('data-loop'));
  let now = 0;

  // React renders in tasks that the fake clock doesn't control, so each step waits for them to drain.
  const step = async () => {
    await page.clock.runFor(FRAME_MS);
    now += FRAME_MS;
    await page.evaluate(async (moment) => {
      for (let hop = 0; hop < 3; hop += 1) {
        await new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.addEventListener('message', resolve, { once: true });
          channel.port1.start();
          channel.port2.postMessage(null);
        });
      }
      // An animation's id is free for this: on first sight it records the moment the animation started.
      for (const animation of document.getAnimations()) {
        if (animation.id === '') {
          animation.id = String(moment);
          animation.pause();
        }
        animation.currentTime = moment - Number(animation.id);
      }
    }, now);
  };

  // The first loop counts the dashboard up from zero. Every loop after it is the same.
  const count = Math.round(loop / FRAME_MS);
  for (let index = 0; index < count; index += 1) {
    await step();
  }
  for (let index = 0; index < count; index += 1) {
    await figure.screenshot({ path: join(frames, `${String(index).padStart(4, '0')}.png`) });
    await step();
  }
} finally {
  await browser.close();
  if (server.pid !== undefined) {
    process.kill(-server.pid);
  }
}

const scale = OUTPUT_SCALE / CAPTURE_SCALE;
const ffmpeg = spawn(
  'ffmpeg',
  [
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    join(frames, '%04d.png'),
    '-vf',
    `scale=iw*${scale}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
    '-loop',
    '0',
    OUTPUT,
  ],
  { stdio: 'inherit' },
);
const code = await new Promise<number | null>((resolve) => {
  ffmpeg.on('close', resolve);
});
await rm(frames, { recursive: true });
if (code !== 0) {
  throw new Error(`ffmpeg exited with ${String(code)}`);
}
console.log(`Wrote ${OUTPUT}`);
