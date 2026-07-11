import type { Viewport, XYPosition } from '@xyflow/react';
import {
  BOARD_SCHEMA_VERSION,
  CARD_KINDS,
  TASK_STATUSES,
  type BoardDocument,
  type CanvasEdge,
  type CanvasNode,
  type CardData,
  type CardKind,
  type TaskStatus,
} from '../types/board';

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };

const CARD_TITLES: Record<CardKind, string> = {
  note: '未命名笔记',
  source: '未命名来源',
  insight: '未命名洞察',
  task: '未命名行动',
};

const TIDY_ORIGIN = 80;
const TIDY_COLUMN_GAP = 360;
const TIDY_ROW_GAP = 220;

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid board document at ${path}: ${message}`);
}

function readString(value: unknown, path: string, nonEmpty = false): string {
  if (typeof value !== 'string' || (nonEmpty && value.trim().length === 0)) {
    return fail(path, nonEmpty ? 'expected a non-empty string' : 'expected a string');
  }
  return value;
}

function readFiniteNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(path, 'expected a finite number');
  }
  return value;
}

function readPositiveNumber(value: unknown, path: string): number {
  const number = readFiniteNumber(value, path);
  if (number <= 0) return fail(path, 'expected a number greater than zero');
  return number;
}

function readCardKind(value: unknown, path: string): CardKind {
  if (typeof value !== 'string' || !(CARD_KINDS as readonly string[]).includes(value)) {
    return fail(path, `expected one of ${CARD_KINDS.join(', ')}`);
  }
  return value as CardKind;
}

function readTaskStatus(value: unknown, path: string): TaskStatus {
  if (typeof value !== 'string' || !(TASK_STATUSES as readonly string[]).includes(value)) {
    return fail(path, `expected one of ${TASK_STATUSES.join(', ')}`);
  }
  return value as TaskStatus;
}

function readPosition(value: unknown, path: string): XYPosition {
  if (!isRecord(value)) return fail(path, 'expected an object');
  return {
    x: readFiniteNumber(value.x, `${path}.x`),
    y: readFiniteNumber(value.y, `${path}.y`),
  };
}

function readViewport(value: unknown, path: string): Viewport {
  if (!isRecord(value)) return fail(path, 'expected an object');
  return {
    x: readFiniteNumber(value.x, `${path}.x`),
    y: readFiniteNumber(value.y, `${path}.y`),
    zoom: readPositiveNumber(value.zoom, `${path}.zoom`),
  };
}

function readCardData(value: unknown, path: string): CardData {
  if (!isRecord(value)) return fail(path, 'expected an object');

  const kind = readCardKind(value.kind, `${path}.kind`);
  const tagsValue = value.tags ?? [];
  if (!Array.isArray(tagsValue)) return fail(`${path}.tags`, 'expected an array');

  const data: CardData = {
    kind,
    title: readString(value.title, `${path}.title`),
    body: value.body === undefined ? '' : readString(value.body, `${path}.body`),
    tags: tagsValue.map((tag, index) => readString(tag, `${path}.tags[${index}]`)),
  };

  if (value.status !== undefined) {
    data.status = readTaskStatus(value.status, `${path}.status`);
  } else if (kind === 'task') {
    data.status = 'todo';
  }

  if (value.url !== undefined) {
    data.url = readString(value.url, `${path}.url`);
  }

  return data;
}

function readNode(value: unknown, index: number): CanvasNode {
  const path = `nodes[${index}]`;
  if (!isRecord(value)) return fail(path, 'expected an object');
  if (value.type !== 'card') return fail(`${path}.type`, 'expected "card"');

  const node: CanvasNode = {
    id: readString(value.id, `${path}.id`, true),
    type: 'card',
    position: readPosition(value.position, `${path}.position`),
    data: readCardData(value.data, `${path}.data`),
  };

  if (value.width !== undefined) node.width = readPositiveNumber(value.width, `${path}.width`);
  if (value.height !== undefined) node.height = readPositiveNumber(value.height, `${path}.height`);

  return node;
}

function readEdge(value: unknown, index: number): CanvasEdge {
  const path = `edges[${index}]`;
  if (!isRecord(value)) return fail(path, 'expected an object');

  const edge: CanvasEdge = {
    id: readString(value.id, `${path}.id`, true),
    source: readString(value.source, `${path}.source`, true),
    target: readString(value.target, `${path}.target`, true),
  };

  if (value.label !== undefined) edge.label = readString(value.label, `${path}.label`);
  if (value.type !== undefined) edge.type = readString(value.type, `${path}.type`, true);

  return edge;
}

export function parseBoardDocument(input: unknown): BoardDocument {
  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return fail('$', 'expected valid JSON');
    }
  }

  if (!isRecord(value)) return fail('$', 'expected an object');
  if (value.schemaVersion !== BOARD_SCHEMA_VERSION) {
    return fail('schemaVersion', `expected ${BOARD_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.nodes)) return fail('nodes', 'expected an array');
  if (!Array.isArray(value.edges)) return fail('edges', 'expected an array');

  const nodes = value.nodes.map(readNode);
  const edges = value.edges.map(readEdge);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const [index, node] of nodes.entries()) {
    if (nodeIds.has(node.id)) return fail(`nodes[${index}].id`, 'duplicate node id');
    nodeIds.add(node.id);
  }

  for (const [index, edge] of edges.entries()) {
    if (edgeIds.has(edge.id)) return fail(`edges[${index}].id`, 'duplicate edge id');
    if (!nodeIds.has(edge.source)) return fail(`edges[${index}].source`, 'unknown node id');
    if (!nodeIds.has(edge.target)) return fail(`edges[${index}].target`, 'unknown node id');
    edgeIds.add(edge.id);
  }

  const updatedAt = readString(value.updatedAt, 'updatedAt', true);
  if (Number.isNaN(Date.parse(updatedAt))) return fail('updatedAt', 'expected a valid date string');

  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    id: readString(value.id, 'id', true),
    title: readString(value.title, 'title'),
    nodes,
    edges,
    viewport:
      value.viewport === undefined
        ? { ...DEFAULT_VIEWPORT }
        : readViewport(value.viewport, 'viewport'),
    updatedAt,
  };
}

export function createCardNode(kind: CardKind, position: XYPosition): CanvasNode {
  const data: CardData = {
    kind,
    title: CARD_TITLES[kind],
    body: '',
    tags: [],
  };

  if (kind === 'task') data.status = 'todo';
  if (kind === 'source') data.url = '';

  return {
    id: createId('node'),
    type: 'card',
    position: { ...position },
    data,
  };
}

export function duplicateNode(node: CanvasNode): CanvasNode {
  return {
    ...node,
    id: createId('node'),
    selected: false,
    dragging: false,
    position: { x: node.position.x + 32, y: node.position.y + 32 },
    data: {
      ...node.data,
      tags: [...node.data.tags],
    },
  };
}

export function tidyNodes(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  if (nodes.length === 0) return [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of edges) {
    if (
      edge.source === edge.target ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      continue;
    }
    outgoing.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }

  const queue = nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const layers = new Map(queue.map((id) => [id, 0]));

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const source = queue[cursor];
    const sourceLayer = layers.get(source) ?? 0;
    for (const target of outgoing.get(source) ?? []) {
      layers.set(target, Math.max(layers.get(target) ?? 0, sourceLayer + 1));
      const remaining = (incoming.get(target) ?? 1) - 1;
      incoming.set(target, remaining);
      if (remaining === 0) queue.push(target);
    }
  }

  const highestResolvedLayer = Math.max(0, ...layers.values());
  const fallbackLayer = layers.size === 0 ? 0 : highestResolvedLayer + 1;
  for (const node of nodes) {
    if (!layers.has(node.id)) layers.set(node.id, fallbackLayer);
  }

  const rowByLayer = new Map<number, number>();
  const positions = new Map<string, XYPosition>();
  for (const node of nodes) {
    const layer = layers.get(node.id) ?? 0;
    const row = rowByLayer.get(layer) ?? 0;
    positions.set(node.id, {
      x: TIDY_ORIGIN + layer * TIDY_COLUMN_GAP,
      y: TIDY_ORIGIN + row * TIDY_ROW_GAP,
    });
    rowByLayer.set(layer, row + 1);
  }

  return nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  }));
}
