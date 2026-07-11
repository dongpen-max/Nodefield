import type { BoardDocument } from '../types/board';
import { parseBoardDocument } from './board';

export { parseBoardDocument } from './board';

export const BOARD_STORAGE_KEY = 'nodefield.board.v1';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getBrowserStorage(): StorageAdapter | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadBoard(
  storage: StorageAdapter | undefined = getBrowserStorage(),
  key = BOARD_STORAGE_KEY,
): BoardDocument | null {
  if (!storage) return null;

  try {
    const stored = storage.getItem(key);
    return stored === null ? null : parseBoardDocument(stored);
  } catch {
    return null;
  }
}

export function saveBoard(
  board: BoardDocument,
  storage: StorageAdapter | undefined = getBrowserStorage(),
  key = BOARD_STORAGE_KEY,
): void {
  if (!storage) throw new Error('Browser storage is unavailable');
  const validated = parseBoardDocument(board);
  storage.setItem(key, JSON.stringify(validated));
}
