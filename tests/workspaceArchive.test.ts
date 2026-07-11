import { describe, expect, it } from 'vitest';
import { createBlankBoard, createStarterBoard } from '../src/data/starterBoard';
import {
  WORKSPACE_ARCHIVE_SCHEMA_VERSION,
  createWorkspaceArchive,
  exportWorkspaceArchive,
  parseWorkspaceArchive,
} from '../src/lib/workspaceArchive';
import type { BoardDocument } from '../src/types/board';

const EXPORTED_AT = '2026-07-11T08:00:00.000Z';

function createBoard(id: string, title = id): BoardDocument {
  return {
    ...createBlankBoard(title),
    id,
    updatedAt: '2026-07-11T07:00:00.000Z',
  };
}

function rawArchive(boards: BoardDocument[], activeBoardId: string): Record<string, unknown> {
  return {
    schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
    exportedAt: EXPORTED_AT,
    activeBoardId,
    boards,
  };
}

describe('workspace archive', () => {
  it('creates a validated archive and strips runtime selection state', () => {
    const first = createStarterBoard();
    first.id = 'first';
    first.nodes[0].selected = true;
    first.nodes[0].dragging = true;
    first.edges[0].selected = true;
    const second = createBoard('second');

    const archive = createWorkspaceArchive([first, second], second.id, EXPORTED_AT);

    expect(archive).toMatchObject({
      schemaVersion: WORKSPACE_ARCHIVE_SCHEMA_VERSION,
      exportedAt: EXPORTED_AT,
      activeBoardId: 'second',
    });
    expect(archive.boards).toHaveLength(2);
    expect(archive.boards[0].nodes[0]).not.toHaveProperty('selected');
    expect(archive.boards[0].nodes[0]).not.toHaveProperty('dragging');
    expect(archive.boards[0].edges[0]).not.toHaveProperty('selected');
  });

  it('round-trips stable JSON and accepts both strings and objects', () => {
    const archive = createWorkspaceArchive(
      [createBoard('first'), createBoard('second')],
      'first',
      EXPORTED_AT,
    );

    const json = exportWorkspaceArchive(archive);

    expect(exportWorkspaceArchive(archive)).toBe(json);
    expect(Object.keys(JSON.parse(json) as object)).toEqual([
      'schemaVersion',
      'exportedAt',
      'activeBoardId',
      'boards',
    ]);
    expect(parseWorkspaceArchive(json)).toEqual(archive);
    expect(parseWorkspaceArchive(JSON.parse(json))).toEqual(archive);
  });

  it('rejects invalid JSON and non-object roots', () => {
    expect(() => parseWorkspaceArchive('{not-json')).toThrow(/valid JSON/);
    expect(() => parseWorkspaceArchive([])).toThrow(/expected an object/);
  });

  it('rejects empty and duplicate board ids', () => {
    const emptyId = createBoard('first');
    emptyId.id = '   ';
    expect(() => parseWorkspaceArchive(rawArchive([emptyId], '   '))).toThrow(
      /boards\[0\].*id/,
    );

    expect(() =>
      parseWorkspaceArchive(rawArchive([createBoard('same'), createBoard('same')], 'same')),
    ).toThrow(/duplicate board id/);
  });

  it('rejects a missing active board', () => {
    expect(() =>
      parseWorkspaceArchive(rawArchive([createBoard('present')], 'missing')),
    ).toThrow(/activeBoardId/);
  });

  it('rejects an empty board collection', () => {
    expect(() => parseWorkspaceArchive(rawArchive([], 'missing'))).toThrow(/non-empty array/);
  });

  it('rejects malformed board documents', () => {
    const board = createBoard('broken');
    board.schemaVersion = 99 as typeof board.schemaVersion;

    expect(() => parseWorkspaceArchive(rawArchive([board], board.id))).toThrow(
      /boards\[0\].*schemaVersion/,
    );
  });

  it('rejects invalid export dates and archive schema versions', () => {
    for (const exportedAt of ['not-a-date', '2026-02-30T00:00:00.000Z']) {
      expect(() =>
        parseWorkspaceArchive({
          ...rawArchive([createBoard('first')], 'first'),
          exportedAt,
        }),
      ).toThrow(/exportedAt/);
    }

    expect(() =>
      parseWorkspaceArchive({
        ...rawArchive([createBoard('first')], 'first'),
        schemaVersion: 2,
      }),
    ).toThrow(/schemaVersion/);
  });
});
