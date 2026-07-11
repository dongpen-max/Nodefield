import { describe, expect, it } from 'vitest';
import { createBlankBoard, createStarterBoard } from '../src/data/starterBoard';
import {
  BOARD_STORAGE_KEY,
  MemoryBoardStorage,
  initializeBoardStorage,
  loadBoard,
  saveBoard,
  type LegacyStorageAdapter,
  type StorageAdapter,
} from '../src/lib/storage';

class MemoryStorage implements StorageAdapter, LegacyStorageAdapter {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('board storage', () => {
  it('round-trips a validated document', () => {
    const storage = new MemoryStorage();
    const board = createStarterBoard();

    saveBoard(board, storage);

    expect(loadBoard(storage)).toEqual(board);
    expect(storage.values.has(BOARD_STORAGE_KEY)).toBe(true);
  });

  it('returns null for missing or corrupt data', () => {
    const storage = new MemoryStorage();
    expect(loadBoard(storage)).toBeNull();

    storage.setItem(BOARD_STORAGE_KEY, '{not-json');
    expect(loadBoard(storage)).toBeNull();
  });

  it('creates an empty board with an independent identity', () => {
    const first = createBlankBoard();
    const second = createBlankBoard('Second canvas');

    expect(first.id).not.toBe(second.id);
    expect(first).toMatchObject({ title: '未命名画布', nodes: [], edges: [] });
    expect(second.title).toBe('Second canvas');
  });

  it('sorts multiple boards by updated time and validates writes', async () => {
    const older = createBlankBoard('Older');
    older.updatedAt = '2026-07-10T00:00:00.000Z';
    const newer = createBlankBoard('Newer');
    newer.updatedAt = '2026-07-11T00:00:00.000Z';
    const storage = new MemoryBoardStorage([older]);

    await storage.putBoard(newer);

    expect((await storage.listBoards()).map((board) => board.title)).toEqual([
      'Newer',
      'Older',
    ]);
    await expect(
      storage.putBoard({ ...newer, schemaVersion: 99 } as unknown as typeof newer),
    ).rejects.toThrow(/schemaVersion/);
  });

  it('puts a board and active id as one operation', async () => {
    const storage = new MemoryBoardStorage();
    const board = createBlankBoard('Active');

    await storage.putBoardAndSetActive(board);

    expect(await storage.getActiveBoardId()).toBe(board.id);
    expect(await storage.getBoard(board.id)).toEqual(board);
  });

  it('atomically replaces the complete workspace while preserving backup metadata', async () => {
    const original = createBlankBoard('Original');
    const first = createBlankBoard('First replacement');
    first.updatedAt = '2026-07-11T10:00:00.000Z';
    const second = createBlankBoard('Second replacement');
    second.updatedAt = '2026-07-11T09:00:00.000Z';
    const storage = new MemoryBoardStorage([original], original.id);
    const lastBackupAt = '2026-07-11T08:30:00.000Z';
    await storage.setLastBackupAt(lastBackupAt);

    await storage.replaceWorkspace([first, second], second.id);

    expect((await storage.listBoards()).map((board) => board.id)).toEqual([
      first.id,
      second.id,
    ]);
    expect(await storage.getBoard(original.id)).toBeNull();
    expect(await storage.getBoard(first.id)).toEqual(first);
    expect(await storage.getBoard(second.id)).toEqual(second);
    expect(await storage.getActiveBoardId()).toBe(second.id);
    expect(await storage.getLastBackupAt()).toBe(lastBackupAt);
  });

  it('does not change the workspace when replacement input is invalid', async () => {
    const original = createBlankBoard('Original');
    const replacement = createBlankBoard('Replacement');
    const invalid = {
      ...replacement,
      schemaVersion: 99,
    } as unknown as typeof replacement;
    const storage = new MemoryBoardStorage([original], original.id);

    const invalidReplacements: Array<[Array<typeof replacement>, string]> = [
      [[], original.id],
      [[replacement, replacement], replacement.id],
      [[replacement], original.id],
      [[replacement, invalid], replacement.id],
    ];

    for (const [boards, activeBoardId] of invalidReplacements) {
      await expect(storage.replaceWorkspace(boards, activeBoardId)).rejects.toThrow();
      expect(await storage.listBoards()).toEqual([
        {
          id: original.id,
          title: original.title,
          updatedAt: original.updatedAt,
        },
      ]);
      expect(await storage.getActiveBoardId()).toBe(original.id);
    }
  });

  it('round-trips and exposes the last backup time during initialization', async () => {
    const board = createBlankBoard('Backed up');
    const storage = new MemoryBoardStorage([board], board.id);
    const lastBackupAt = '2026-07-11T09:45:00.000Z';

    expect(await storage.getLastBackupAt()).toBeNull();
    await storage.setLastBackupAt(lastBackupAt);

    const initialized = await initializeBoardStorage(storage, new MemoryStorage());
    expect(await storage.getLastBackupAt()).toBe(lastBackupAt);
    expect(initialized.lastBackupAt).toBe(lastBackupAt);
  });

  it('rejects ambiguous or invalid backup timestamps', async () => {
    const storage = new MemoryBoardStorage();

    for (const value of ['2026-07-11', 'not-a-date', '2026-02-30T00:00:00.000Z']) {
      await expect(storage.setLastBackupAt(value)).rejects.toThrow(/ISO date string/);
      expect(await storage.getLastBackupAt()).toBeNull();
    }
  });

  it('prefers existing boards and repairs a dangling active id', async () => {
    const existing = createBlankBoard('IndexedDB board');
    const legacy = createBlankBoard('Legacy board');
    const storage = new MemoryBoardStorage([existing], 'missing-board');
    const localStorage = new MemoryStorage();
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(legacy));

    const initialized = await initializeBoardStorage(storage, localStorage);

    expect(initialized.activeBoard.id).toBe(existing.id);
    expect(await storage.getActiveBoardId()).toBe(existing.id);
    expect(await storage.getBoard(legacy.id)).toBeNull();
    expect(localStorage.getItem(BOARD_STORAGE_KEY)).not.toBeNull();
  });

  it('migrates a valid localStorage V1 board before removing it', async () => {
    const board = createStarterBoard();
    const storage = new MemoryBoardStorage();
    const localStorage = new MemoryStorage();
    localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(board));

    const initialized = await initializeBoardStorage(storage, localStorage);

    expect(initialized.activeBoard).toEqual(board);
    expect(initialized.warning).toBeUndefined();
    expect(await storage.getBoard(board.id)).toEqual(board);
    expect(localStorage.getItem(BOARD_STORAGE_KEY)).toBeNull();
  });

  it('preserves corrupt legacy data and starts with a valid board', async () => {
    const storage = new MemoryBoardStorage();
    const localStorage = new MemoryStorage();
    localStorage.setItem(BOARD_STORAGE_KEY, '{not-json');

    const initialized = await initializeBoardStorage(storage, localStorage);

    expect(initialized.warning).toMatch(/无法迁移/);
    expect(initialized.activeBoard.nodes.length).toBeGreaterThan(0);
    expect(localStorage.getItem(BOARD_STORAGE_KEY)).toBe('{not-json');
    expect(initialized.boards).toHaveLength(1);
  });

  it('creates a starter board when no stored data exists', async () => {
    const storage = new MemoryBoardStorage();
    const initialized = await initializeBoardStorage(storage, new MemoryStorage());

    expect(initialized.activeBoard.nodes.length).toBeGreaterThan(0);
    expect(await storage.getActiveBoardId()).toBe(initialized.activeBoard.id);
    expect(initialized.boards).toHaveLength(1);
  });
});
