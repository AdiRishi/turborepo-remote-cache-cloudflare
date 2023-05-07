import { MockedFunction, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Env } from '../';
import { isDateOlderThan } from '../utils/date';
import { deleteOldCache } from './deleteOldCache';

vi.mock('../utils/date', async (importActual) => {
  const actual = await importActual<typeof import('../utils/date')>();
  return {
    ...actual,
    isDateOlderThan: vi.fn(actual.isDateOlderThan),
  };
});
const isDateOlderThanMock = isDateOlderThan as MockedFunction<typeof isDateOlderThan>;

const describe = setupMiniflareIsolatedStorage();

describe('R2 delete cron', () => {
  const workerEnv = getMiniflareBindings<Env>();
  const artifactId = 'UNIQUE-artifactId-' + Math.random();
  const artifactTag = 'UNIQUE-artifactTag-' + Math.random();
  const teamId = 'UNIQUE-teamId-' + Math.random();
  const artifactContent = '🎉😄😇';

  beforeEach(async () => {
    await workerEnv.R2_STORE.put(`${teamId}/${artifactId}`, artifactContent, {
      customMetadata: { artifactTag },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should delete artifact when it is older than the cutoff', async () => {
    isDateOlderThanMock.mockReturnValue(true);
    await deleteOldCache(workerEnv);
    const artifact = await workerEnv.R2_STORE.get(`${teamId}/${artifactId}`);
    expect(artifact).toBeNull();
  });

  test('should not delete artifact when it is newer than the cutoff', async () => {
    isDateOlderThanMock.mockReturnValue(false);
    await deleteOldCache(workerEnv);
    const artifact = await workerEnv.R2_STORE.get(`${teamId}/${artifactId}`);
    expect(artifact).not.toBeNull();
    expect(await artifact?.text()).toEqual(artifactContent);
  });

  test('should delete all artifacts when there are more than CURSOR_SIZE', async () => {
    isDateOlderThanMock.mockReturnValue(true);
    for (let i = 0; i < 1000; i++) {
      await workerEnv.R2_STORE.put(`${teamId}/${artifactId}-${i}`, artifactContent, {
        customMetadata: { artifactTag },
      });
    }

    await deleteOldCache(workerEnv);

    const artifacts = await workerEnv.R2_STORE.list();
    expect(artifacts.objects.length).toEqual(0);
  });
});
