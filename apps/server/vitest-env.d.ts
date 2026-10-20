import { type Env } from './src/index';

declare module 'cloudflare:workers' {
  // oxlint-disable-next-line typescript/no-empty-object-type
  interface ProvidedEnv extends Env {}
}
