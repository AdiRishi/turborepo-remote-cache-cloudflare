import { Files } from 'files-sdk';
import { memory, type MemoryAdapter } from 'files-sdk/memory';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { CURSOR_SIZE, deleteOldCache } from '~/crons/deleteOldCache';
import { isDateOlderThan } from '~/utils/date';

vi.mock('~/utils/date', async (importActual) => {
  const actual = await importActual<typeof import('~/utils/date')>();
  return {
    ...actual,
    isDateOlderThan: vi.fn<typeof actual.isDateOlderThan>(actual.isDateOlderThan),
  };
});

const isDateOlderThanMock = vi.mocked(isDateOlderThan);

describe('deleteOldCache', () => {
  let adapter: MemoryAdapter;
  let files: Files<MemoryAdapter>;

  beforeEach(() => {
    adapter = memory();
    files = new Files({ adapter });
    isDateOlderThanMock.mockReset();
  });

  test('deletes artifacts older than the configured retention window', async () => {
    await files.upload('team/artifact', 'payload');
    isDateOlderThanMock.mockReturnValue(true);

    const result = await deleteOldCache(files, 24);

    expect(result).toEqual({ deleted: 1, skipped: 0 });
    expect(await files.exists('team/artifact')).toBe(false);
    expect(isDateOlderThanMock).toHaveBeenCalledWith(expect.any(Date), 24);
  });

  test('keeps artifacts that are still inside the retention window', async () => {
    await files.upload('team/artifact', 'payload');
    isDateOlderThanMock.mockReturnValue(false);
    const deleteSpy = vi.spyOn(files, 'delete');

    const result = await deleteOldCache(files, 24);

    expect(result).toEqual({ deleted: 0, skipped: 0 });
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(await (await files.download('team/artifact')).text()).toBe('payload');
  });

  test('lists every page before deleting more than one provider page', async () => {
    const artifactCount = CURSOR_SIZE + 17;
    adapter = memory({
      initial: Object.fromEntries(
        Array.from({ length: artifactCount }, (_, index) => [
          `team/artifact-${String(index).padStart(4, '0')}`,
          'payload',
        ]),
      ),
    });
    files = new Files({ adapter });
    isDateOlderThanMock.mockReturnValue(true);
    const listSpy = vi.spyOn(files, 'list');

    const result = await deleteOldCache(files, 720);

    expect(result).toEqual({ deleted: artifactCount, skipped: 0 });
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect((await files.list()).items).toHaveLength(0);
  });

  test('skips objects whose provider cannot supply last-modified metadata', async () => {
    await files.upload('legacy-artifact', 'payload');
    const entry = adapter.raw.get('legacy-artifact');
    if (!entry) throw new Error('Expected seeded memory entry');
    Reflect.deleteProperty(entry, 'lastModified');
    isDateOlderThanMock.mockReturnValue(true);

    const result = await deleteOldCache(files, 720);

    expect(result).toEqual({ deleted: 0, skipped: 1 });
    expect(await files.exists('legacy-artifact')).toBe(true);
    expect(isDateOlderThanMock).not.toHaveBeenCalled();
  });

  test('disables retention entirely when configured with zero hours', async () => {
    await files.upload('team/artifact', 'payload');
    const listSpy = vi.spyOn(files, 'list');

    const result = await deleteOldCache(files, 0);

    expect(result).toEqual({ deleted: 0, skipped: 0 });
    expect(listSpy).not.toHaveBeenCalled();
    expect(isDateOlderThanMock).not.toHaveBeenCalled();
    expect(await files.exists('team/artifact')).toBe(true);
  });
});
