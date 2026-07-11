import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const executable = (name) =>
  join(projectRoot, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.CMD` : name);
const wait = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const appendTail = (current, chunk) => `${current}${chunk}`.slice(-20_000);

const availablePort = async () => {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = probe.address();
  assert(address && typeof address === 'object');
  await new Promise((resolvePromise, reject) => {
    probe.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolvePromise();
    });
  });
  return address.port;
};

const run = (command, arguments_, options) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      ...options,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout = appendTail(stdout, chunk)));
    child.stderr.on('data', (chunk) => (stderr = appendTail(stderr, chunk)));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolvePromise({ stderr, stdout });
        return;
      }
      reject(
        new Error(
          `${command} ${arguments_.join(' ')} exited with code ${code}\n${stdout}${stderr}`,
        ),
      );
    });
  });

const stop = async (child) => {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await Promise.race([exited, wait(2_000)]);
  if (child.exitCode === null) {
    const forcedExit = once(child, 'exit');
    child.kill('SIGKILL');
    await Promise.race([forcedExit, wait(2_000)]);
  }
};

const port = await availablePort();
const token = `turbo-smoke-${randomUUID()}`;
const temporaryRoot = await mkdtemp(join(tmpdir(), 'turborepo-remote-cache-'));
const fixture = join(temporaryRoot, 'fixture');
const counter = join(temporaryRoot, 'execution-count');
const marker = `remote-cache-${randomUUID()}`;
const wranglerConfigPath = join(temporaryRoot, 'wrangler.json');
await writeFile(
  wranglerConfigPath,
  JSON.stringify({
    compatibility_date: '2026-07-08',
    compatibility_flags: ['nodejs_compat'],
    name: 'remote-cache-smoke',
    r2_buckets: [{ binding: 'R2_STORE', bucket_name: 'remote-cache-smoke' }],
    vars: { CACHE_RETENTION_HOURS: 720, STORAGE_PROVIDER: 'r2', TURBO_TOKEN: token },
  }),
);
const server = spawn(executable('nitro'), ['dev', `--port=${port}`, '--host=127.0.0.1'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NITRO_CLOUDFLARE_DEV_CONFIG_PATH: wranglerConfigPath,
    NITRO_CLOUDFLARE_DEV_PERSIST_DIR: join(temporaryRoot, 'wrangler-state'),
  },
  shell: process.platform === 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverError;
let serverOutput = '';
server.stdout.setEncoding('utf8');
server.stderr.setEncoding('utf8');
server.stdout.on('data', (chunk) => (serverOutput = appendTail(serverOutput, chunk)));
server.stderr.on('data', (chunk) => (serverOutput = appendTail(serverOutput, chunk)));
server.once('error', (error) => (serverError = error));

try {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (serverError) throw serverError;
    if (server.exitCode !== null) {
      throw new Error(`Nitro exited before it became ready\n${serverOutput}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ping`);
      if (response.ok) break;
    } catch {
      // The server is still starting.
    }
    await wait(100);
  }

  const ready = await fetch(`http://127.0.0.1:${port}/ping`).catch(() => undefined);
  if (!ready?.ok) throw new Error(`Nitro did not become ready\n${serverOutput}`);

  await mkdir(fixture);
  await Promise.all([
    writeFile(
      join(fixture, 'package.json'),
      `${JSON.stringify(
        {
          name: 'remote-cache-smoke',
          packageManager: 'pnpm@11.6.0',
          private: true,
          scripts: { build: 'node build.mjs' },
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      join(fixture, 'turbo.json'),
      `${JSON.stringify(
        {
          $schema: 'https://turborepo.dev/schema.json',
          remoteCache: { signature: true },
          tasks: {
            build: {
              inputs: ['build.mjs', 'marker.txt'],
              outputs: ['dist/**'],
              passThroughEnv: ['EXECUTION_COUNTER'],
            },
          },
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      join(fixture, 'build.mjs'),
      `import { mkdir, readFile, writeFile } from 'node:fs/promises';

const count = Number(await readFile(process.env.EXECUTION_COUNTER, 'utf8').catch(() => '0')) + 1;
await writeFile(process.env.EXECUTION_COUNTER, String(count));
await mkdir('dist', { recursive: true });
await writeFile('dist/result.txt', await readFile('marker.txt', 'utf8'));
`,
    ),
    writeFile(join(fixture, 'marker.txt'), marker),
  ]);

  await run(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['install', '--lockfile-only', '--ignore-scripts'],
    {
      cwd: fixture,
      env: process.env,
    },
  );

  const turboEnvironment = {
    ...process.env,
    EXECUTION_COUNTER: counter,
    TURBO_API: `http://127.0.0.1:${port}`,
    TURBO_REMOTE_CACHE_SIGNATURE_KEY: '0123456789abcdef0123456789abcdef',
    TURBO_TEAM: `team_smoke_${randomUUID().replaceAll('-', '')}`,
    TURBO_TELEMETRY_DISABLED: '1',
    TURBO_TOKEN: token,
  };
  const turboArguments = ['run', 'build', '--cache=remote:rw', '--log-order=stream'];

  const firstRun = await run(executable('turbo'), turboArguments, {
    cwd: fixture,
    env: turboEnvironment,
  });
  assert.match(`${firstRun.stdout}${firstRun.stderr}`, /cache miss/i);
  assert.equal(await readFile(counter, 'utf8'), '1');

  await rm(join(fixture, 'dist'), { force: true, recursive: true });

  const secondRun = await run(executable('turbo'), turboArguments, {
    cwd: fixture,
    env: turboEnvironment,
  });
  assert.match(`${secondRun.stdout}${secondRun.stderr}`, /cache hit/i);
  assert.equal(await readFile(counter, 'utf8'), '1');
  assert.equal(await readFile(join(fixture, 'dist/result.txt'), 'utf8'), marker);

  console.log('Turbo CLI restored a signed artifact from the remote cache.');
} finally {
  await stop(server);
  await rm(temporaryRoot, { force: true, recursive: true });
}
