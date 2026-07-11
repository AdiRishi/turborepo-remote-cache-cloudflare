import { Files } from 'files-sdk';
import { memory, type MemoryAdapter, type MemoryAdapterOptions } from 'files-sdk/memory';

import type { AppBindings } from '~/runtime/app-env';

export const TEST_TOKEN = 'test-token';

export interface TestAppContext {
  adapter: MemoryAdapter;
  bindings: AppBindings;
  files: Files<MemoryAdapter>;
  waitForBackgroundWork: () => Promise<void>;
}

export const createTestAppContext = (options?: MemoryAdapterOptions): TestAppContext => {
  const adapter = memory(options);
  const files = new Files({ adapter });
  const backgroundWork: Promise<unknown>[] = [];

  return {
    adapter,
    bindings: {
      CACHE_RETENTION_HOURS: 720,
      FILES: files,
      STORAGE_PROVIDER_RESOLVED: 'custom',
      TURBO_TOKEN: TEST_TOKEN,
      WAIT_UNTIL: (promise) => backgroundWork.push(promise),
    },
    files,
    waitForBackgroundWork: async () => {
      await Promise.all(backgroundWork);
    },
  };
};

export const withAuthorization = (headers?: HeadersInit): Headers => {
  const authorizedHeaders = new Headers(headers);
  authorizedHeaders.set('Authorization', `Bearer ${TEST_TOKEN}`);
  return authorizedHeaders;
};
