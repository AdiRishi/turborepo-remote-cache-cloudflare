import { type MockedFunction, test, afterEach, beforeEach, vi } from 'vitest';
import { deleteOldCache } from '~/crons/deleteOldCache';
import { Env } from '~/index';
import { StorageManager } from '~/storage';
import { isDateOlderThan } from '~/utils/date';

const describe = setupMiniflareIsolatedStorage();

vi.mock('~/utils/date', async (importActual) => {
  const actual = await importActual<typeof import('~/utils/date')>();
  return {
    ...actual,
    isDateOlderThan: vi.fn(actual.isDateOlderThan),
  };
});
const isDateOlderThanMock = isDateOlderThan as MockedFunction<typeof isDateOlderThan>;

describe('deleteOldCache', () => {
  let workerEnv: Env;
  const artifactId = 'UNIQUE-artifactId-' + Math.random();
  const artifactTag = 'UNIQUE-artifactTag-' + Math.random();
  const customMetadata = { artifactId, artifactTag };
  const teamId = 'UNIQUE-teamId-' + Math.random();
  const artifactContent = '🎉😄😇';

  beforeEach(() => {
    workerEnv = getMiniflareBindings();
  });

  describe('r2 storage', () => {
    beforeEach(() => {
      workerEnv = { ...workerEnv, KV_STORE: undefined };
      workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
    });

    test('should delete artifact when it is older than the cutoff', async () => {
      isDateOlderThanMock.mockReturnValue(true);
    });
  });
});
