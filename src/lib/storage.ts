import type { BoardDocument } from '../types/board';
import { createStarterBoard } from '../data/starterBoard';
import { parseBoardDocument } from './board';

export { parseBoardDocument } from './board';

export const BOARD_STORAGE_KEY = 'nodefield.board.v1';
export const DB_NAME = 'nodefield';
export const DB_VERSION = 1;

const BOARDS_STORE = 'boards';
const META_STORE = 'meta';
const ACTIVE_BOARD_KEY = 'activeBoardId';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LegacyStorageAdapter {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export type BoardSummary = Pick<BoardDocument, 'id' | 'title' | 'updatedAt'>;

export interface BoardStorage {
  listBoards(): Promise<BoardSummary[]>;
  getBoard(id: string): Promise<BoardDocument | null>;
  putBoard(board: BoardDocument): Promise<void>;
  deleteBoard(id: string): Promise<void>;
  getActiveBoardId(): Promise<string | null>;
  setActiveBoardId(id: string): Promise<void>;
  putBoardAndSetActive(board: BoardDocument): Promise<void>;
}

export interface BoardStorageInitialization {
  storage: BoardStorage;
  activeBoard: BoardDocument;
  boards: BoardSummary[];
  warning?: string;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

function getBrowserStorage(): StorageAdapter | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function getLegacyBrowserStorage(): LegacyStorageAdapter | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function getBrowserIndexedDb(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB;
  } catch {
    return undefined;
  }
}

function cloneBoard(board: BoardDocument): BoardDocument {
  return parseBoardDocument(board);
}

function boardSummary(board: BoardDocument): BoardSummary {
  return { id: board.id, title: board.title, updatedAt: board.updatedAt };
}

function summarizeBoards(boards: unknown[]): BoardSummary[] {
  const summaries: BoardSummary[] = [];
  for (const board of boards) {
    try {
      summaries.push(boardSummary(parseBoardDocument(board)));
    } catch {
      // Keep one damaged record from hiding the user's other valid canvases.
    }
  }

  return summaries.sort(
    (left, right) =>
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      left.id.localeCompare(right.id),
  );
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted'));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    let blocked = false;

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(BOARDS_STORE)) {
        database.createObjectStore(BOARDS_STORE, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('IndexedDB upgrade is blocked by another open Nodefield tab'));
    };
  });
}

class IndexedDbBoardStorage implements BoardStorage {
  private databasePromise: Promise<IDBDatabase> | undefined;

  constructor(private readonly factory: IDBFactory | undefined) {}

  private database(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new Error('Browser IndexedDB is unavailable'));
    this.databasePromise ??= openDatabase(this.factory);
    return this.databasePromise;
  }

  async listBoards(): Promise<BoardSummary[]> {
    const database = await this.database();
    const transaction = database.transaction(BOARDS_STORE, 'readonly');
    const done = transactionDone(transaction);
    const stored = await requestResult<unknown[]>(transaction.objectStore(BOARDS_STORE).getAll());
    await done;
    return summarizeBoards(stored);
  }

  async getBoard(id: string): Promise<BoardDocument | null> {
    const database = await this.database();
    const transaction = database.transaction(BOARDS_STORE, 'readonly');
    const done = transactionDone(transaction);
    const stored = await requestResult<unknown>(transaction.objectStore(BOARDS_STORE).get(id));
    await done;
    if (stored === undefined) return null;
    try {
      return parseBoardDocument(stored);
    } catch {
      return null;
    }
  }

  async putBoard(board: BoardDocument): Promise<void> {
    const validated = parseBoardDocument(board);
    const database = await this.database();
    const transaction = database.transaction(BOARDS_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const request = requestResult(transaction.objectStore(BOARDS_STORE).put(validated));
    await Promise.all([request, done]);
  }

  async deleteBoard(id: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(BOARDS_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const request = requestResult(transaction.objectStore(BOARDS_STORE).delete(id));
    await Promise.all([request, done]);
  }

  async getActiveBoardId(): Promise<string | null> {
    const database = await this.database();
    const transaction = database.transaction(META_STORE, 'readonly');
    const done = transactionDone(transaction);
    const stored = await requestResult<MetaRecord | undefined>(
      transaction.objectStore(META_STORE).get(ACTIVE_BOARD_KEY),
    );
    await done;
    return typeof stored?.value === 'string' && stored.value.trim() ? stored.value : null;
  }

  async setActiveBoardId(id: string): Promise<void> {
    if (!id.trim()) throw new Error('Active board id must be a non-empty string');
    if (!(await this.getBoard(id))) throw new Error(`Board not found: ${id}`);

    const database = await this.database();
    const transaction = database.transaction(META_STORE, 'readwrite');
    const done = transactionDone(transaction);
    const request = requestResult(
      transaction.objectStore(META_STORE).put({ key: ACTIVE_BOARD_KEY, value: id }),
    );
    await Promise.all([request, done]);
  }

  async putBoardAndSetActive(board: BoardDocument): Promise<void> {
    const validated = parseBoardDocument(board);
    const database = await this.database();
    const transaction = database.transaction([BOARDS_STORE, META_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const putBoardRequest = requestResult(
      transaction.objectStore(BOARDS_STORE).put(validated),
    );
    const putActiveRequest = requestResult(
      transaction
        .objectStore(META_STORE)
        .put({ key: ACTIVE_BOARD_KEY, value: validated.id }),
    );
    await Promise.all([putBoardRequest, putActiveRequest, done]);
  }
}

export function createIndexedDbBoardStorage(
  factory: IDBFactory | undefined = getBrowserIndexedDb(),
): BoardStorage {
  return new IndexedDbBoardStorage(factory);
}

export class MemoryBoardStorage implements BoardStorage {
  private readonly boards = new Map<string, BoardDocument>();
  private activeBoardId: string | null;

  constructor(initialBoards: BoardDocument[] = [], activeBoardId: string | null = null) {
    for (const board of initialBoards) {
      const validated = cloneBoard(board);
      this.boards.set(validated.id, validated);
    }
    this.activeBoardId = activeBoardId;
  }

  async listBoards(): Promise<BoardSummary[]> {
    return summarizeBoards([...this.boards.values()].map(cloneBoard));
  }

  async getBoard(id: string): Promise<BoardDocument | null> {
    const board = this.boards.get(id);
    return board ? cloneBoard(board) : null;
  }

  async putBoard(board: BoardDocument): Promise<void> {
    const validated = cloneBoard(board);
    this.boards.set(validated.id, validated);
  }

  async deleteBoard(id: string): Promise<void> {
    this.boards.delete(id);
  }

  async getActiveBoardId(): Promise<string | null> {
    return this.activeBoardId;
  }

  async setActiveBoardId(id: string): Promise<void> {
    if (!id.trim()) throw new Error('Active board id must be a non-empty string');
    if (!this.boards.has(id)) throw new Error(`Board not found: ${id}`);
    this.activeBoardId = id;
  }

  async putBoardAndSetActive(board: BoardDocument): Promise<void> {
    const validated = cloneBoard(board);
    this.boards.set(validated.id, validated);
    this.activeBoardId = validated.id;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function initializedResult(
  storage: BoardStorage,
  activeBoard: BoardDocument,
  warning?: string,
): Promise<BoardStorageInitialization> {
  return {
    storage,
    activeBoard: parseBoardDocument(activeBoard),
    boards: await storage.listBoards(),
    ...(warning ? { warning } : {}),
  };
}

export async function initializeBoardStorage(
  storage: BoardStorage = createIndexedDbBoardStorage(),
  legacyStorage: LegacyStorageAdapter | undefined = getLegacyBrowserStorage(),
): Promise<BoardStorageInitialization> {
  const existingBoards = await storage.listBoards();
  if (existingBoards.length) {
    const activeId = await storage.getActiveBoardId();
    const activeBoard = activeId ? await storage.getBoard(activeId) : null;
    if (activeBoard) return initializedResult(storage, activeBoard);

    const fallback = await storage.getBoard(existingBoards[0].id);
    if (!fallback) throw new Error('The newest stored board could not be loaded');
    await storage.setActiveBoardId(fallback.id);
    return initializedResult(storage, fallback);
  }

  let warning: string | undefined;
  let legacyValue: string | null = null;
  if (legacyStorage) {
    try {
      legacyValue = legacyStorage.getItem(BOARD_STORAGE_KEY);
    } catch (error) {
      warning = `无法读取旧版本地数据：${errorMessage(error)}`;
    }
  }

  if (legacyValue !== null) {
    let legacyBoard: BoardDocument | undefined;
    try {
      legacyBoard = parseBoardDocument(legacyValue);
    } catch (error) {
      warning = `旧版本地画布无法迁移：${errorMessage(error)}`;
    }

    if (legacyBoard) {
      await storage.putBoardAndSetActive(legacyBoard);
      try {
        legacyStorage?.removeItem(BOARD_STORAGE_KEY);
      } catch (error) {
        warning = `旧版本地画布已迁移，但无法清理旧副本：${errorMessage(error)}`;
      }
      return initializedResult(storage, legacyBoard, warning);
    }
  }

  const starter = createStarterBoard();
  await storage.putBoardAndSetActive(starter);
  return initializedResult(storage, starter, warning);
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
