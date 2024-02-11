import { type MockedFunction, test, expect, afterEach, beforeEach, vi } from 'vitest';
import { CURSOR_SIZE, deleteOldCache } from '~/crons/deleteOldCache';
import { Env } from '~/index';
import { KvStorage, R2Storage, StorageInterface, StorageManager } from '~/storage';
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
    let storage: StorageInterface;

    beforeEach(async () => {
      workerEnv = { ...workerEnv, KV_STORE: undefined };
      workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
      storage = workerEnv.STORAGE_MANAGER.getActiveStorage();
      await storage.write(`${teamId}/${artifactId}`, artifactContent, customMetadata);
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('should use r2 storage', () => {
      expect(workerEnv.STORAGE_MANAGER.getActiveStorage()).toBe(storage);
      expect(storage).toBeInstanceOf(R2Storage);
    });

    test('should delete artifact when it is older than the cutoff', async () => {
      isDateOlderThanMock.mockReturnValue(true);
      await deleteOldCache(workerEnv);
      const artifact = await storage.read(`${teamId}/${artifactId}`);
      expect(artifact).toBeUndefined();
    });

    test('should not delete artifact when it is not older than the cutoff', async () => {
      isDateOlderThanMock.mockReturnValue(false);
      await deleteOldCache(workerEnv);
      const artifactStream = await storage.read(`${teamId}/${artifactId}`);
      expect(artifactStream).toBeDefined();
      const artifact = await StorageManager.readableStreamToText(artifactStream!);
      expect(artifact).toBe(artifactContent);
    });

    test('should delete all artifacts when the number of artifacts exceeds CURSOR_SIZE', async () => {
      isDateOlderThanMock.mockReturnValue(true);
      for (let i = 0; i < Math.round(CURSOR_SIZE * 1.5); i++) {
        await storage.write(`${teamId}/${artifactId}-${i}`, artifactContent, customMetadata);
      }
      await deleteOldCache(workerEnv);
      const artifacts = await storage.list();
      expect(artifacts.keys.length).toBe(0);
    });

    test('should delete all artifacts when there are over 1000 items ready for deletion', async () => {
      isDateOlderThanMock.mockReturnValue(true);
      for (let i = 0; i < Math.round(CURSOR_SIZE * 1.5); i++) {
        await storage.write(`${teamId}/${artifactId}-${i}`, artifactContent, customMetadata);
      }
      await deleteOldCache(workerEnv);
      const artifacts = await storage.list();
      expect(artifacts.keys.length).toBe(0);
    });

    test('should not call delete with no keys', async () => {
      const spy = vi.spyOn(storage, 'delete');
      isDateOlderThanMock.mockReturnValue(false); // Make sure no objects are marked for deletion
      await deleteOldCache(workerEnv);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('kv storage', () => {
    let storage: StorageInterface;

    beforeEach(async () => {
      workerEnv = { ...workerEnv, R2_STORE: undefined };
      workerEnv.STORAGE_MANAGER = new StorageManager(workerEnv);
      storage = workerEnv.STORAGE_MANAGER.getActiveStorage();
      await storage.write(`${teamId}/${artifactId}`, artifactContent, customMetadata);
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    test('should use kv storage', () => {
      expect(workerEnv.STORAGE_MANAGER.getActiveStorage()).toBe(storage);
      expect(storage).toBeInstanceOf(KvStorage);
    });

    test('should delete artifact when it is older than the cutoff', async () => {
      isDateOlderThanMock.mockReturnValue(true);
      await deleteOldCache(workerEnv);
      const artifact = await storage.read(`${teamId}/${artifactId}`);
      expect(artifact).toBeUndefined();
    });

    test('should not delete artifact when it is not older than the cutoff', async () => {
      isDateOlderThanMock.mockReturnValue(false);
      await deleteOldCache(workerEnv);
      const artifactStream = await storage.read(`${teamId}/${artifactId}`);
      expect(artifactStream).toBeDefined();
      const artifact = await StorageManager.readableStreamToText(artifactStream!);
      expect(artifact).toBe(artifactContent);
    });

    test('should delete all artifacts when the number of artifacts exceeds CURSOR_SIZE', async () => {
      isDateOlderThanMock.mockReturnValue(true);
      for (let i = 0; i < Math.round(CURSOR_SIZE * 1.5); i++) {
        await storage.write(`${teamId}/${artifactId}-${i}`, artifactContent, customMetadata);
      }
      await deleteOldCache(workerEnv);
      const artifacts = await storage.list();
      expect(artifacts.keys.length).toBe(0);
    });

    test('should delete all artifacts when there are over 1000 items ready for deletion', async () => {
      isDateOlderThanMock.mockReturnValue(true);
      for (let i = 0; i < Math.round(CURSOR_SIZE * 1.5); i++) {
        await storage.write(`${teamId}/${artifactId}-${i}`, artifactContent, customMetadata);
      }
      await deleteOldCache(workerEnv);
      const artifacts = await storage.list();
      expect(artifacts.keys.length).toBe(0);
    });

    test('should not call delete with no keys', async () => {
      const spy = vi.spyOn(storage, 'delete');
      isDateOlderThanMock.mockReturnValue(false); // Make sure no objects are marked for deletion
      await deleteOldCache(workerEnv);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
