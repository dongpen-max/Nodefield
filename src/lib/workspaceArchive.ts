import type { BoardDocument } from '../types/board';
import { parseBoardDocument } from './board';

export const WORKSPACE_ARCHIVE_SCHEMA_VERSION = 1 as const;

export interface WorkspaceArchive {
  schemaVersion: typeof WORKSPACE_ARCHIVE_SCHEMA_VERSION;
  exportedAt: string;
  activeBoardId: string;
  boards: BoardDocument[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string, message: string): never {
  throw new Error(`Invalid workspace archive at ${path}: ${message}`);
}

function readNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return invalid(path, 'expected a non-empty string');
  }
  return value;
}

function readDate(value: unknown, path: string): string {
  const date = readNonEmptyString(value, path);
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== date) {
    return invalid(path, 'expected an ISO date string');
  }
  return date;
}

export function parseWorkspaceArchive(input: unknown): WorkspaceArchive {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return invalid('$', 'expected valid JSON');
    }
  }

  if (!isRecord(value)) return invalid('$', 'expected an object');
  if (value.schemaVersion !== WORKSPACE_ARCHIVE_SCHEMA_VERSION) {
    return invalid('schemaVersion', `expected ${WORKSPACE_ARCHIVE_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.boards) || value.boards.length === 0) {
    return invalid('boards', 'expected a non-empty array');
  }

  const boards = value.boards.map((board, index) => {
    try {
      return parseBoardDocument(board);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invalid board document';
      return invalid(`boards[${index}]`, message);
    }
  });
  const boardIds = new Set<string>();
  for (const [index, board] of boards.entries()) {
    if (boardIds.has(board.id)) return invalid(`boards[${index}].id`, 'duplicate board id');
    boardIds.add(board.id);
  }

  const activeBoardId = readNonEmptyString(value.activeBoardId, 'activeBoardId');
  if (!boardIds.has(activeBoardId)) {
    return invalid('activeBoardId', 'expected an existing board id');
  }

  return {
    schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
    exportedAt: readDate(value.exportedAt, 'exportedAt'),
    activeBoardId,
    boards,
  };
}

export function createWorkspaceArchive(
  boards: readonly BoardDocument[],
  activeBoardId: string,
  exportedAt = new Date().toISOString(),
): WorkspaceArchive {
  return parseWorkspaceArchive({
    schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
    exportedAt,
    activeBoardId,
    boards,
  });
}

export function exportWorkspaceArchive(archive: WorkspaceArchive): string {
  return JSON.stringify(parseWorkspaceArchive(archive), null, 2);
}
