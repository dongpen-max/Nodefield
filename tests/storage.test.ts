import { describe, expect, it } from 'vitest';
import { createStarterBoard } from '../src/data/starterBoard';
import { BOARD_STORAGE_KEY, loadBoard, saveBoard, type StorageAdapter } from '../src/lib/storage';

class MemoryStorage implements StorageAdapter {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
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
});
