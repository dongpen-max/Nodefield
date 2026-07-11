import type { Edge, Node, Viewport } from '@xyflow/react';

export const BOARD_SCHEMA_VERSION = 1 as const;

export const CARD_KINDS = ['note', 'source', 'insight', 'task'] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EDGE_PATHS = ['smoothstep', 'default', 'straight', 'step', 'simplebezier'] as const;
export type EdgePath = (typeof EDGE_PATHS)[number];

export interface CardData extends Record<string, unknown> {
  kind: CardKind;
  title: string;
  body: string;
  tags: string[];
  status?: TaskStatus;
  url?: string;
}

export type CanvasNode = Node<CardData, 'card'> & { type: 'card' };
export type CanvasEdge = Edge;

export interface BoardDocument {
  schemaVersion: typeof BOARD_SCHEMA_VERSION;
  id: string;
  title: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  updatedAt: string;
}
