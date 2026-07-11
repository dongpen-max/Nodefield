import type { Viewport } from '@xyflow/react';
import {
  BOARD_SCHEMA_VERSION,
  CARD_KINDS,
  TASK_STATUSES,
  type BoardDocument,
  type CardData,
  type CardKind,
  type TaskStatus,
} from '../types/board';
import { DEFAULT_VIEWPORT, parseBoardDocument } from './board';

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 160;

type JsonCanvasSide = 'top' | 'right' | 'bottom' | 'left';
type JsonCanvasEnd = 'none' | 'arrow';

interface JsonCanvasNodefieldData {
  kind: CardKind;
  title: string;
  body: string;
  tags: string[];
  status?: TaskStatus;
  url?: string;
}

interface JsonCanvasNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  nodefield?: JsonCanvasNodefieldData;
}

interface JsonCanvasTextNode extends JsonCanvasNodeBase {
  type: 'text';
  text: string;
}

interface JsonCanvasLinkNode extends JsonCanvasNodeBase {
  type: 'link';
  url: string;
}

interface JsonCanvasFileNode extends JsonCanvasNodeBase {
  type: 'file';
  file: string;
}

interface JsonCanvasGroupNode extends JsonCanvasNodeBase {
  type: 'group';
  label?: string;
}

type JsonCanvasNode =
  | JsonCanvasTextNode
  | JsonCanvasLinkNode
  | JsonCanvasFileNode
  | JsonCanvasGroupNode;

interface JsonCanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: JsonCanvasSide;
  toSide?: JsonCanvasSide;
  fromEnd?: JsonCanvasEnd;
  toEnd?: JsonCanvasEnd;
  color?: string;
  label?: string;
}

interface JsonCanvasDocument {
  nodes: JsonCanvasNode[];
  edges: JsonCanvasEdge[];
  nodefield?: {
    schemaVersion: typeof BOARD_SCHEMA_VERSION;
    boardId: string;
    title: string;
    viewport: Viewport;
    updatedAt: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string, message: string): never {
  throw new Error(`Invalid JSON Canvas at ${path}: ${message}`);
}

function stringAt(value: unknown, path: string, nonEmpty = false): string {
  if (typeof value !== 'string' || (nonEmpty && value.trim().length === 0)) {
    return invalid(path, nonEmpty ? 'expected a non-empty string' : 'expected a string');
  }
  return value;
}

function numberAt(value: unknown, path: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive && value <= 0)) {
    return invalid(path, positive ? 'expected a positive finite number' : 'expected a finite number');
  }
  return value;
}

function integerAt(value: unknown, path: string, positive = false): number {
  const number = numberAt(value, path, positive);
  if (!Number.isInteger(number)) return invalid(path, 'expected an integer');
  return number;
}

function optionalCanvasColor(value: unknown, path: string): void {
  if (value === undefined) return;
  const color = stringAt(value, path, true);
  if (!/^(?:[1-6]|#[0-9a-fA-F]{6})$/.test(color)) {
    return invalid(path, 'expected a preset color from 1 to 6 or a six-digit hex color');
  }
}

function optionalSide(value: unknown, path: string): void {
  if (
    value !== undefined &&
    value !== 'top' &&
    value !== 'right' &&
    value !== 'bottom' &&
    value !== 'left'
  ) {
    return invalid(path, 'expected top, right, bottom, or left');
  }
}

function cardColor(kind: CardKind): string {
  return { note: '3', source: '5', insight: '1', task: '4' }[kind];
}

function nodeSize(node: BoardDocument['nodes'][number]): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(node.width ?? node.measured?.width ?? DEFAULT_NODE_WIDTH)),
    height: Math.max(1, Math.round(node.height ?? node.measured?.height ?? DEFAULT_NODE_HEIGHT)),
  };
}

function textContent(data: CardData): string {
  if (data.title && data.body) return `# ${data.title}\n\n${data.body}`;
  if (data.title) return `# ${data.title}`;
  return data.body;
}

function extensionData(data: CardData): JsonCanvasNodefieldData {
  return {
    kind: data.kind,
    title: data.title,
    body: data.body,
    tags: [...data.tags],
    ...(data.status ? { status: data.status } : {}),
    ...(data.url !== undefined ? { url: data.url } : {}),
  };
}

export function exportJsonCanvas(board: BoardDocument): string {
  const validBoard = parseBoardDocument(board);
  const document: JsonCanvasDocument = {
    nodes: validBoard.nodes.map((node): JsonCanvasNode => {
      const size = nodeSize(node);
      const base: JsonCanvasNodeBase = {
        id: node.id,
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
        ...size,
        color: cardColor(node.data.kind),
        nodefield: extensionData(node.data),
      };

      if (node.data.kind === 'source' && node.data.url) {
        return { ...base, type: 'link', url: node.data.url };
      }
      return { ...base, type: 'text', text: textContent(node.data) };
    }),
    edges: validBoard.edges.map((edge) => ({
      id: edge.id,
      fromNode: edge.source,
      toNode: edge.target,
      fromEnd: 'none',
      toEnd: 'arrow',
      ...(typeof edge.label === 'string' ? { label: edge.label } : {}),
    })),
    nodefield: {
      schemaVersion: BOARD_SCHEMA_VERSION,
      boardId: validBoard.id,
      title: validBoard.title,
      viewport: { ...validBoard.viewport },
      updatedAt: validBoard.updatedAt,
    },
  };

  return JSON.stringify(document, null, 2);
}

function cardDataFromText(text: string): CardData {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.startsWith('# ')) {
    return {
      kind: 'note',
      title: lines[0].slice(2),
      body: lines.slice(1).join('\n').replace(/^\n+/, ''),
      tags: [],
    };
  }

  const firstLine = lines.shift() ?? '';
  return {
    kind: 'note',
    title: firstLine,
    body: lines.join('\n').replace(/^\n+/, ''),
    tags: [],
  };
}

function titleFromResource(resource: string): string {
  try {
    const url = new URL(resource);
    return url.hostname || resource;
  } catch {
    const parts = resource.split(/[\\/]/);
    return parts.at(-1) || resource;
  }
}

function readExtension(value: unknown, path: string): CardData | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return invalid(path, 'expected an object');

  if (typeof value.kind !== 'string' || !(CARD_KINDS as readonly string[]).includes(value.kind)) {
    return invalid(`${path}.kind`, `expected one of ${CARD_KINDS.join(', ')}`);
  }
  const tags = value.tags ?? [];
  if (!Array.isArray(tags)) return invalid(`${path}.tags`, 'expected an array');

  const data: CardData = {
    kind: value.kind as CardKind,
    title: stringAt(value.title, `${path}.title`),
    body: value.body === undefined ? '' : stringAt(value.body, `${path}.body`),
    tags: tags.map((tag, index) => stringAt(tag, `${path}.tags[${index}]`)),
  };

  if (value.status !== undefined) {
    if (
      typeof value.status !== 'string' ||
      !(TASK_STATUSES as readonly string[]).includes(value.status)
    ) {
      return invalid(`${path}.status`, `expected one of ${TASK_STATUSES.join(', ')}`);
    }
    data.status = value.status as TaskStatus;
  } else if (data.kind === 'task') {
    data.status = 'todo';
  }
  if (value.url !== undefined) data.url = stringAt(value.url, `${path}.url`);
  return data;
}

function readCanvasNode(value: unknown, index: number): BoardDocument['nodes'][number] {
  const path = `nodes[${index}]`;
  if (!isRecord(value)) return invalid(path, 'expected an object');

  const id = stringAt(value.id, `${path}.id`, true);
  const type = stringAt(value.type, `${path}.type`, true);
  const position = {
    x: integerAt(value.x, `${path}.x`),
    y: integerAt(value.y, `${path}.y`),
  };
  const width = integerAt(value.width, `${path}.width`, true);
  const height = integerAt(value.height, `${path}.height`, true);
  const extension = readExtension(value.nodefield, `${path}.nodefield`);
  optionalCanvasColor(value.color, `${path}.color`);

  let data: CardData;
  if (type === 'text') {
    data = extension ?? cardDataFromText(stringAt(value.text, `${path}.text`));
  } else if (type === 'link') {
    const url = stringAt(value.url, `${path}.url`, true);
    try {
      new URL(url);
    } catch {
      return invalid(`${path}.url`, 'expected a valid URL');
    }
    data = extension ?? { kind: 'source', title: titleFromResource(url), body: '', tags: [], url };
  } else if (type === 'file') {
    const file = stringAt(value.file, `${path}.file`, true);
    if (value.subpath !== undefined) {
      const subpath = stringAt(value.subpath, `${path}.subpath`, true);
      if (!subpath.startsWith('#')) return invalid(`${path}.subpath`, 'expected a leading #');
    }
    data = extension ?? { kind: 'source', title: titleFromResource(file), body: '', tags: [], url: file };
  } else if (type === 'group') {
    if (value.background !== undefined) {
      stringAt(value.background, `${path}.background`, true);
    }
    if (
      value.backgroundStyle !== undefined &&
      value.backgroundStyle !== 'cover' &&
      value.backgroundStyle !== 'ratio' &&
      value.backgroundStyle !== 'repeat'
    ) {
      return invalid(`${path}.backgroundStyle`, 'expected cover, ratio, or repeat');
    }
    data =
      extension ??
      {
        kind: 'note',
        title: value.label === undefined ? 'Imported group' : stringAt(value.label, `${path}.label`),
        body: '',
        tags: ['group'],
      };
  } else {
    return invalid(`${path}.type`, 'expected text, link, file, or group');
  }

  return { id, type: 'card', position, width, height, data };
}

function readCanvasEdge(value: unknown, index: number): BoardDocument['edges'][number] {
  const path = `edges[${index}]`;
  if (!isRecord(value)) return invalid(path, 'expected an object');
  const fromNode = stringAt(value.fromNode, `${path}.fromNode`, true);
  const toNode = stringAt(value.toNode, `${path}.toNode`, true);

  optionalSide(value.fromSide, `${path}.fromSide`);
  optionalSide(value.toSide, `${path}.toSide`);
  optionalCanvasColor(value.color, `${path}.color`);

  if (value.fromEnd !== undefined && value.fromEnd !== 'none' && value.fromEnd !== 'arrow') {
    return invalid(`${path}.fromEnd`, 'expected none or arrow');
  }
  if (value.toEnd !== undefined && value.toEnd !== 'none' && value.toEnd !== 'arrow') {
    return invalid(`${path}.toEnd`, 'expected none or arrow');
  }

  const reverse = value.fromEnd === 'arrow' && value.toEnd !== 'arrow';
  return {
    id: stringAt(value.id, `${path}.id`, true),
    source: reverse ? toNode : fromNode,
    target: reverse ? fromNode : toNode,
    ...(value.label === undefined ? {} : { label: stringAt(value.label, `${path}.label`) }),
  };
}

function readRootMetadata(value: unknown): {
  boardId?: string;
  title?: string;
  viewport: Viewport;
  updatedAt?: string;
} {
  if (value === undefined) return { viewport: { ...DEFAULT_VIEWPORT } };
  if (!isRecord(value)) return invalid('nodefield', 'expected an object');
  if (value.schemaVersion !== undefined && value.schemaVersion !== BOARD_SCHEMA_VERSION) {
    return invalid('nodefield.schemaVersion', `expected ${BOARD_SCHEMA_VERSION}`);
  }

  let viewport = { ...DEFAULT_VIEWPORT };
  if (value.viewport !== undefined) {
    if (!isRecord(value.viewport)) return invalid('nodefield.viewport', 'expected an object');
    viewport = {
      x: numberAt(value.viewport.x, 'nodefield.viewport.x'),
      y: numberAt(value.viewport.y, 'nodefield.viewport.y'),
      zoom: numberAt(value.viewport.zoom, 'nodefield.viewport.zoom', true),
    };
  }

  return {
    boardId:
      value.boardId === undefined ? undefined : stringAt(value.boardId, 'nodefield.boardId', true),
    title: value.title === undefined ? undefined : stringAt(value.title, 'nodefield.title'),
    viewport,
    updatedAt:
      value.updatedAt === undefined ? undefined : stringAt(value.updatedAt, 'nodefield.updatedAt', true),
  };
}

function createBoardId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `board-${Date.now().toString(36)}`;
}

export function importJsonCanvas(value: unknown, title?: string): BoardDocument {
  let document = value;
  if (typeof value === 'string') {
    try {
      document = JSON.parse(value) as unknown;
    } catch {
      return invalid('$', 'expected valid JSON');
    }
  }
  if (!isRecord(document)) return invalid('$', 'expected an object');
  if (document.nodes !== undefined && !Array.isArray(document.nodes)) {
    return invalid('nodes', 'expected an array');
  }
  if (document.edges !== undefined && !Array.isArray(document.edges)) {
    return invalid('edges', 'expected an array');
  }

  const metadata = readRootMetadata(document.nodefield);
  const imported: BoardDocument = {
    schemaVersion: BOARD_SCHEMA_VERSION,
    id: metadata.boardId ?? createBoardId(),
    title: title ?? metadata.title ?? 'Imported canvas',
    nodes: (document.nodes ?? []).map(readCanvasNode),
    edges: (document.edges ?? []).map(readCanvasEdge),
    viewport: metadata.viewport,
    updatedAt: metadata.updatedAt ?? new Date().toISOString(),
  };

  return parseBoardDocument(imported);
}
