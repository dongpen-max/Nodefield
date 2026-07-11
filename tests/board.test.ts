import { describe, expect, it } from 'vitest';
import { createStarterBoard } from '../src/data/starterBoard';
import { createCardNode, duplicateNode, parseBoardDocument, tidyNodes } from '../src/lib/board';

describe('board domain', () => {
  it('creates independent typed nodes', () => {
    const task = createCardNode('task', { x: 12, y: 24 });
    const copy = duplicateNode(task);

    expect(task.type).toBe('card');
    expect(task.data.status).toBe('todo');
    expect(copy.id).not.toBe(task.id);
    expect(copy.position).toEqual({ x: 44, y: 56 });
    expect(copy.data.tags).not.toBe(task.data.tags);
  });

  it('validates and normalizes a missing legacy viewport', () => {
    const source = createStarterBoard();
    const raw = JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
    delete raw.viewport;

    expect(parseBoardDocument(raw).viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('rejects malformed nodes and dangling edges', () => {
    const malformed = createStarterBoard();
    malformed.nodes[0].type = 'other' as 'card';
    expect(() => parseBoardDocument(malformed)).toThrow(/nodes\[0\]\.type/);

    const dangling = createStarterBoard();
    dangling.edges[0].target = 'missing';
    expect(() => parseBoardDocument(dangling)).toThrow(/unknown node id/);
  });

  it('places dependencies in later topology columns', () => {
    const board = createStarterBoard();
    const laidOut = tidyNodes(board.nodes, board.edges);
    const positions = Object.fromEntries(laidOut.map((node) => [node.id, node.position]));

    expect(positions['starter-source'].x).toBeGreaterThan(positions['starter-question'].x);
    expect(positions['starter-insight'].x).toBeGreaterThan(positions['starter-source'].x);
    expect(positions['starter-task'].x).toBeGreaterThan(positions['starter-insight'].x);
  });
});
