import { BOARD_SCHEMA_VERSION, type BoardDocument, type CanvasNode } from '../types/board';

function createBoardId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `board-${Date.now().toString(36)}`;
}

export function createBlankBoard(title = '未命名画布'): BoardDocument {
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    id: createBoardId(),
    title,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    updatedAt: new Date().toISOString(),
  };
}

function starterNodes(): CanvasNode[] {
  return [
    {
      id: 'starter-question',
      type: 'card',
      position: { x: 80, y: 180 },
      data: {
        kind: 'note',
        title: '什么让画布值得信任？',
        body: '先写下真正要回答的问题，再决定需要哪些材料。',
        tags: ['起点'],
      },
    },
    {
      id: 'starter-source',
      type: 'card',
      position: { x: 440, y: 40 },
      data: {
        kind: 'source',
        title: 'JSON Canvas 1.0',
        body: '开放格式让节点、坐标与关系能够跨工具迁移。',
        tags: ['证据', '开放格式'],
        url: 'https://jsoncanvas.org/',
      },
    },
    {
      id: 'starter-insight',
      type: 'card',
      position: { x: 440, y: 300 },
      data: {
        kind: 'insight',
        title: '文件所有权就是产品能力',
        body: '保存、恢复、导入和导出不应是隐藏在设置里的补充功能。',
        tags: ['洞察'],
      },
    },
    {
      id: 'starter-task',
      type: 'card',
      position: { x: 800, y: 180 },
      data: {
        kind: 'task',
        title: '先完成本地优先闭环',
        body: '在加入同步或 AI 之前，确保核心工作流离线可用。',
        tags: ['下一步'],
        status: 'todo',
      },
    },
  ];
}

export function createStarterBoard(): BoardDocument {
  return {
    schemaVersion: BOARD_SCHEMA_VERSION,
    id: createBoardId(),
    title: '无限画布融合研究',
    nodes: starterNodes(),
    edges: [
      {
        id: 'starter-edge-evidence',
        source: 'starter-question',
        target: 'starter-source',
        label: '需要证据',
        type: 'smoothstep',
      },
      {
        id: 'starter-edge-insight',
        source: 'starter-source',
        target: 'starter-insight',
        label: '支持',
        type: 'smoothstep',
      },
      {
        id: 'starter-edge-action',
        source: 'starter-insight',
        target: 'starter-task',
        label: '导向',
        type: 'smoothstep',
      },
    ],
    viewport: { x: 0, y: 0, zoom: 0.9 },
    updatedAt: new Date().toISOString(),
  };
}

export const starterBoard: BoardDocument = createStarterBoard();
