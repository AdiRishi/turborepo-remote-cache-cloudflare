import { type Env } from './src/index';

declare module 'cloudflare:workers' {
  interface ProvidedEnv extends Env {
    KV_STORE: KVNamespace;
  }
}
