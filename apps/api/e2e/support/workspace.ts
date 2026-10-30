import type { ExecFileOptions } from 'node:child_process';

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as v from 'valibot';

const exec = (file: string, args: string[], options: ExecFileOptions = {}) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      file,
      args,
      { ...options, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stdout}${stderr}`, { cause: error }));
        } else {
          resolve({ stdout, stderr });
        }
      },
    );
  });

const serverUrl = process.env.E2E_BASE_URL;
if (serverUrl === undefined) {
  throw new Error(
    'Set E2E_BASE_URL to the running server. `pnpm test:e2e` starts one and sets it.',
  );
}
export const SERVER_URL = serverUrl;

const rootRequire = createRequire(join(import.meta.dirname, '../../../../package.json'));
const TURBO_BIN = rootRequire.resolve('turbo/bin/turbo');

export const TURBO_VERSION = v.parse(
  v.object({ version: v.string() }),
  JSON.parse(await readFile(rootRequire.resolve('turbo/package.json'), 'utf8')),
).version;

const SIGNATURE_KEY = 'e2e-signature-key-of-at-least-32-bytes';

export const LIBRARIES = Array.from(
  { length: 12 },
  (_, index) => `lib-${String(index + 1).padStart(2, '0')}`,
);

/** Every package in the fixture workspace. `app` depends on all the libraries. */
export const PACKAGES = [...LIBRARIES, 'app'];

const BUILD_SCRIPT = `import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const { name } = JSON.parse(readFileSync('package.json', 'utf8'));
const machine = process.env.E2E_MACHINE;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/built-by.txt', machine);
const payloadBytes = Number(process.env.E2E_PAYLOAD_BYTES ?? 0);
if (payloadBytes > 0) {
  writeFileSync('dist/payload.bin', randomBytes(payloadBytes));
}
console.log(\`built \${name} on \${machine}\`);
`;

const json = (value: unknown) => `${JSON.stringify(value, undefined, 2)}\n`;

const packageFiles = (
  name: string,
  dependencies: Record<string, string> = {},
): [string, string][] => [
  [
    `packages/${name}/package.json`,
    json({ name, private: true, dependencies, scripts: { build: 'node ../../build.mjs' } }),
  ],
  [`packages/${name}/src/index.txt`, `${name}\n`],
];

const FIXTURE = Object.fromEntries([
  ...LIBRARIES.flatMap((name) => packageFiles(name)),
  ...packageFiles('app', Object.fromEntries(LIBRARIES.map((name) => [name, '*']))),
  [
    'package.json',
    json({
      name: 'e2e-workspace',
      private: true,
      workspaces: ['packages/*'],
      packageManager: 'npm@11.19.1',
    }),
  ],
  [
    'turbo.json',
    json({
      remoteCache: { signature: true },
      globalDependencies: ['build.mjs'],
      tasks: {
        build: {
          dependsOn: ['^build'],
          outputs: ['dist/**'],
          env: ['E2E_PAYLOAD_BYTES'],
          // The build records which machine ran it, so a restored output names the machine that uploaded it.
          passThroughEnv: ['E2E_MACHINE'],
        },
      },
    }),
  ],
  ['.gitignore', 'node_modules\n.turbo\ndist\n'],
  ['build.mjs', BUILD_SCRIPT],
]);

const CacheSummary = v.object({
  status: v.picklist(['HIT', 'MISS']),
  source: v.optional(v.picklist(['LOCAL', 'REMOTE'])),
  timeSaved: v.number(),
  sha: v.optional(v.string()),
  dirtyHash: v.optional(v.string()),
});

export type TaskCache = v.InferOutput<typeof CacheSummary>;

/** The tasks of a run summary or a `--dry=json` report, keyed by package. */
const TaskReport = v.pipe(
  v.object({ tasks: v.array(v.object({ package: v.string(), cache: CacheSummary })) }),
  v.transform(({ tasks }) => Object.fromEntries(tasks.map((task) => [task.package, task.cache]))),
);

const git = (cwd: string, ...args: string[]) => exec('git', args, { cwd });

const withoutTurboVariables = (env: NodeJS.ProcessEnv) =>
  Object.fromEntries(Object.entries(env).filter(([name]) => !name.startsWith('TURBO_')));

interface CloneOptions {
  team: string;
  /** Environment for every `turbo` run on this machine, over the defaults. */
  env?: Record<string, string>;
}

/** A clone of the fixture workspace with its own checkout and local cache, like a separate machine. */
export interface Machine {
  build: (args?: string[]) => Promise<{ output: string; tasks: Record<string, TaskCache> }>;
  dryRun: () => Promise<Record<string, TaskCache>>;
  /** The machine named in each package's build output. */
  builtBy: () => Promise<Record<string, string>>;
  read: (path: string) => Promise<Buffer>;
  write: (path: string, content: string) => Promise<void>;
}

export const createWorkspace = async () => {
  const root = await mkdtemp(join(tmpdir(), 'turbo-e2e-'));
  const origin = join(root, 'origin');
  for (const [path, content] of Object.entries(FIXTURE)) {
    await mkdir(dirname(join(origin, path)), { recursive: true });
    await writeFile(join(origin, path), content);
  }
  await git(origin, 'init', '--quiet', '--initial-branch=main');
  await git(origin, 'add', '--all');
  await git(
    origin,
    '-c',
    'user.name=e2e',
    '-c',
    'user.email=e2e@example.com',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '--quiet',
    '--message=fixture',
  );

  const clone = async (name: string, { team, env = {} }: CloneOptions): Promise<Machine> => {
    const dir = await mkdtemp(join(root, `${name}-`));
    await git(root, 'clone', '--quiet', origin, dir);

    const turbo = (args: string[]) =>
      exec(process.execPath, [TURBO_BIN, ...args], {
        cwd: dir,
        env: {
          ...withoutTurboVariables(process.env),
          TURBO_API: SERVER_URL,
          TURBO_TOKEN: 'test-token',
          TURBO_TEAM: team,
          TURBO_REMOTE_CACHE_SIGNATURE_KEY: SIGNATURE_KEY,
          TURBO_TELEMETRY_DISABLED: '1',
          E2E_MACHINE: name,
          ...env,
        },
      });

    return {
      build: async (args = []) => {
        const runs = join(dir, '.turbo', 'runs');
        await rm(runs, { recursive: true, force: true });
        const { stdout, stderr } = await turbo(['run', 'build', '--summarize', ...args]);
        const [summary] = await readdir(runs);
        if (summary === undefined) {
          throw new Error(`turbo wrote no run summary:\n${stdout}${stderr}`);
        }
        return {
          output: stdout + stderr,
          tasks: v.parse(TaskReport, JSON.parse(await readFile(join(runs, summary), 'utf8'))),
        };
      },
      dryRun: async () =>
        v.parse(TaskReport, JSON.parse((await turbo(['run', 'build', '--dry=json'])).stdout)),
      builtBy: async () =>
        Object.fromEntries(
          await Promise.all(
            PACKAGES.map(async (pkg): Promise<[string, string]> => [
              pkg,
              await readFile(join(dir, 'packages', pkg, 'dist', 'built-by.txt'), 'utf8'),
            ]),
          ),
        ),
      read: (path) => readFile(join(dir, path)),
      write: (path, content) => writeFile(join(dir, path), content),
    };
  };

  return { clone, remove: () => rm(root, { recursive: true, force: true }) };
};
