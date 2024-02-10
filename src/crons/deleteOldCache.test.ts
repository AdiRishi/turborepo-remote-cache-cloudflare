import { MockedFunction, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { Env } from '../';
import { isDateOlderThan } from '../utils/date';
import { CURSOR_SIZE, deleteOldCache } from './deleteOldCache';
import { StorageInterface, StorageManager } from '../storage';

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
  let storage: StorageInterface;

  beforeAll(() => {
    workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
    storage = workerEnv.STORAGE_MANAGER.getActiveStorage();
  });

  beforeEach(async () => {
    await storage.write(`${teamId}/${artifactId}`, artifactContent, { artifactTag });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should delete artifact when it is older than the cutoff', async () => {
    isDateOlderThanMock.mockReturnValue(true);
    await deleteOldCache(workerEnv);
    const artifact = await storage.read(`${teamId}/${artifactId}`);
    expect(artifact).toBeNull();
  });

  test('should not delete artifact when it is newer than the cutoff', async () => {
    isDateOlderThanMock.mockReturnValue(false);
    await deleteOldCache(workerEnv);
    const artifactStream = await storage.read(`${teamId}/${artifactId}`);
    expect(artifactStream).not.toBeNull();
    expect(await workerEnv.STORAGE_MANAGER.readableStreamToText(artifactStream!)).toEqual(
      artifactContent
    );
  });

  test('should delete all artifacts when there are more than CURSOR_SIZE', async () => {
    isDateOlderThanMock.mockReturnValue(true);
    for (let i = 0; i < Math.round(CURSOR_SIZE * 1.5); i++) {
      await storage.write(`${teamId}/${artifactId}-${i}`, artifactContent, { artifactTag });
    }

    await deleteOldCache(workerEnv);

    const artifacts = await storage.list();
    expect(artifacts.keys.length).toEqual(0);
  });

  test('should delete all artifacts when there are over 1000 items ready for deletion', async () => {
    isDateOlderThanMock.mockReturnValue(true);
    for (let i = 0; i < 1001; i++) {
      await storage.write(`${teamId}/${artifactId}-${i}`, artifactContent, { artifactTag });
    }

    await deleteOldCache(workerEnv);

    const artifacts = await storage.list();
    expect(artifacts.keys.length).toEqual(0);
  });

  test('should not call R2Bucket.delete with no keys', async () => {
    const spy = vi.spyOn(storage, 'delete');
    isDateOlderThanMock.mockReturnValue(false); // Make sure no objects are marked for deletion

    await deleteOldCache(workerEnv);

    expect(spy).not.toHaveBeenCalledWith([]);
  });
});
