import { describe, expect, it } from 'vitest';
import { createStarterBoard } from '../src/data/starterBoard';
import { exportJsonCanvas, importJsonCanvas } from '../src/lib/jsonCanvas';

describe('JSON Canvas 1.0 adapter', () => {
  it('preserves Nodefield card semantics through extensions', () => {
    const board = createStarterBoard();
    const exported = exportJsonCanvas(board);
    const imported = importJsonCanvas(exported);

    expect(imported.title).toBe(board.title);
    expect(imported.nodes.map((node) => node.data.kind)).toEqual(
      board.nodes.map((node) => node.data.kind),
    );
    expect(imported.nodes[3].data.status).toBe('todo');
    expect(imported.nodes[1].data.url).toBe('https://jsoncanvas.org/');
    expect(imported.edges).toHaveLength(board.edges.length);
  });

  it('imports standard text, link, file, and group nodes', () => {
    const imported = importJsonCanvas(
      {
        nodes: [
          { id: 'a', type: 'text', text: '# Finding\n\nUseful detail', x: 0, y: 0, width: 240, height: 120 },
          { id: 'b', type: 'link', url: 'https://example.com/path', x: 300, y: 0, width: 240, height: 120 },
          { id: 'c', type: 'file', file: 'notes/source.pdf', x: 600, y: 0, width: 240, height: 120 },
          { id: 'd', type: 'group', label: 'Cluster', x: 0, y: 220, width: 600, height: 300 },
        ],
        edges: [{ id: 'edge', fromNode: 'a', toNode: 'b', toEnd: 'arrow' }],
      },
      'Research import',
    );

    expect(imported.title).toBe('Research import');
    expect(imported.nodes[0].data).toMatchObject({ title: 'Finding', body: 'Useful detail' });
    expect(imported.nodes[1].data).toMatchObject({ kind: 'source', title: 'example.com' });
    expect(imported.nodes[2].data.url).toBe('notes/source.pdf');
    expect(imported.nodes[3].data.tags).toContain('group');
  });

  it('accepts the spec-defined empty document', () => {
    const imported = importJsonCanvas({});

    expect(imported.nodes).toEqual([]);
    expect(imported.edges).toEqual([]);
  });

  it('rejects invalid geometry and dangling edges', () => {
    expect(() =>
      importJsonCanvas({
        nodes: [{ id: 'a', type: 'text', text: 'A', x: 0, y: 0, width: 0, height: 10 }],
        edges: [],
      }),
    ).toThrow(/nodes\[0\]\.width/);

    expect(() =>
      importJsonCanvas({
        nodes: [{ id: 'a', type: 'text', text: 'A', x: 0.5, y: 0, width: 10, height: 10 }],
      }),
    ).toThrow(/expected an integer/);

    expect(() =>
      importJsonCanvas({
        nodes: [{ id: 'a', type: 'text', text: 'A', x: 0, y: 0, width: 10, height: 10 }],
        edges: [{ id: 'edge', fromNode: 'a', toNode: 'missing' }],
      }),
    ).toThrow(/unknown node id/);
  });
});
