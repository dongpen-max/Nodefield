import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import CardNode from './components/CardNode';
import EdgeInspector from './components/EdgeInspector';
import Inspector from './components/Inspector';
import SelectionInspector from './components/SelectionInspector';
import Toast, { type ToastMessage } from './components/Toast';
import ToolDock, { type CanvasMode } from './components/ToolDock';
import TopBar from './components/TopBar';
import { CARD_META } from './components/cardMeta';
import { createBlankBoard, createStarterBoard } from './data/starterBoard';
import { createCardNode, duplicateNode, parseBoardDocument, tidyNodes } from './lib/board';
import { exportJsonCanvas, importJsonCanvas } from './lib/jsonCanvas';
import type { BoardStorage, BoardSummary } from './lib/storage';
import {
  BOARD_SCHEMA_VERSION,
  type BoardDocument,
  type CardData,
  type CardKind,
  type CanvasEdge,
  type CanvasNode,
} from './types/board';

const nodeTypes = { card: CardNode };
const HISTORY_LIMIT = 50;

interface MergeState {
  key: string;
  at: number;
}

interface AppProps {
  initialBoard: BoardDocument;
  initialBoards: BoardSummary[];
  storage: BoardStorage;
  persistentStorage: boolean;
  initialWarning?: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fileStem(title: string) {
  const stem = title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return stem || 'nodefield-board';
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function nextUntitledBoardTitle(boards: BoardSummary[]): string {
  const titles = new Set(boards.map((board) => board.title));
  if (!titles.has('未命名画布')) return '未命名画布';

  let suffix = 2;
  while (titles.has(`未命名画布 ${suffix}`)) suffix += 1;
  return `未命名画布 ${suffix}`;
}

export default function App({
  initialBoard,
  initialBoards,
  storage,
  persistentStorage,
  initialWarning,
}: AppProps) {
  const flow = useReactFlow<CanvasNode, CanvasEdge>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pastRef = useRef<BoardDocument[]>([]);
  const futureRef = useRef<BoardDocument[]>([]);
  const lastMergeRef = useRef<MergeState | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const boardActionRef = useRef(false);

  const [boardId, setBoardId] = useState(initialBoard.id);
  const [boards, setBoards] = useState<BoardSummary[]>(initialBoards);
  const [title, setTitle] = useState(initialBoard.title);
  const [nodes, setNodes] = useState<CanvasNode[]>(() => clone(initialBoard.nodes));
  const [edges, setEdges] = useState<CanvasEdge[]>(() => clone(initialBoard.edges));
  const [viewport, setViewportState] = useState<Viewport>(initialBoard.viewport);
  const [mode, setMode] = useState<CanvasMode>('select');
  const [query, setQuery] = useState('');
  const [boardActionPending, setBoardActionPending] = useState(false);
  const settledSaveState = persistentStorage ? 'saved' : 'volatile';
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error' | 'volatile'>(
    settledSaveState,
  );
  const [toast, setToast] = useState<ToastMessage | null>(() =>
    initialWarning
      ? { id: Date.now(), text: initialWarning, tone: 'error' }
      : null,
  );
  const [, setHistoryRevision] = useState(0);
  const activeBoardIdRef = useRef(boardId);
  activeBoardIdRef.current = boardId;

  const selectedNodes = useMemo(() => nodes.filter((node) => node.selected), [nodes]);
  const selectedEdges = useMemo(() => edges.filter((edge) => edge.selected), [edges]);
  const selectedNode =
    selectedNodes.length === 1 && selectedEdges.length === 0 ? selectedNodes[0] : null;
  const selectedEdge =
    selectedEdges.length === 1 && selectedNodes.length === 0 ? selectedEdges[0] : null;
  const hasBatchSelection = selectedNodes.length + selectedEdges.length > 1;
  const hasInspector = Boolean(selectedNode || selectedEdge || hasBatchSelection);

  const currentDocument = useCallback(
    (preserveSelection = false): BoardDocument => ({
      schemaVersion: BOARD_SCHEMA_VERSION,
      id: boardId,
      title: title.trim() || '未命名画布',
      nodes: clone(nodes).map((node) => ({
        ...node,
        selected: preserveSelection ? node.selected : false,
      })),
      edges: clone(edges).map((edge) => ({
        ...edge,
        selected: preserveSelection ? edge.selected : false,
      })),
      viewport: clone(viewport),
      updatedAt: new Date().toISOString(),
    }),
    [boardId, edges, nodes, title, viewport],
  );

  const showToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    setToast({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const refreshHistoryState = useCallback(() => {
    setHistoryRevision((revision) => revision + 1);
  }, []);

  const recordHistory = useCallback(
    (mergeKey?: string) => {
      const now = Date.now();
      const lastMerge = lastMergeRef.current;
      const shouldMerge =
        mergeKey && lastMerge?.key === mergeKey && now - lastMerge.at < 700;

      if (!shouldMerge) {
        pastRef.current = [
          ...pastRef.current.slice(-(HISTORY_LIMIT - 1)),
          currentDocument(true),
        ];
      }

      lastMergeRef.current = mergeKey ? { key: mergeKey, at: now } : null;
      futureRef.current = [];
      refreshHistoryState();
    },
    [currentDocument, refreshHistoryState],
  );

  const restoreDocument = useCallback(
    (document: BoardDocument, animateViewport = false) => {
      setBoardId(document.id);
      setTitle(document.title);
      setNodes(clone(document.nodes));
      setEdges(clone(document.edges));
      setViewportState(clone(document.viewport));
      void flow.setViewport(document.viewport, { duration: animateViewport ? 180 : 0 });
      setQuery('');
    },
    [flow],
  );

  const clearHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    lastMergeRef.current = null;
    refreshHistoryState();
  }, [refreshHistoryState]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(currentDocument(true));
    lastMergeRef.current = null;
    restoreDocument(previous);
    refreshHistoryState();
  }, [currentDocument, refreshHistoryState, restoreDocument]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(currentDocument(true));
    lastMergeRef.current = null;
    restoreDocument(next);
    refreshHistoryState();
  }, [currentDocument, refreshHistoryState, restoreDocument]);

  const cancelPendingSave = useCallback(() => {
    if (saveTimerRef.current === null) return;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
  }, []);

  const refreshBoards = useCallback(async () => {
    const nextBoards = await storage.listBoards();
    setBoards(nextBoards);
    return nextBoards;
  }, [storage]);

  const persistDocument = useCallback(
    (document: BoardDocument) => {
      const operation = saveQueueRef.current
        .catch(() => undefined)
        .then(() => storage.putBoard(document));
      saveQueueRef.current = operation.catch(() => undefined);
      return operation;
    },
    [storage],
  );

  const flushCurrentBoard = useCallback(async () => {
    cancelPendingSave();
    const document = currentDocument();
    setSaveState('saving');
    await persistDocument(document);
    await refreshBoards();
    if (activeBoardIdRef.current === document.id) setSaveState(settledSaveState);
    return document;
  }, [cancelPendingSave, currentDocument, persistDocument, refreshBoards, settledSaveState]);

  const runBoardAction = useCallback(
    (action: () => Promise<void>) => {
      if (boardActionRef.current) return;
      boardActionRef.current = true;
      setBoardActionPending(true);
      void action()
        .catch(() => {
          setSaveState('error');
          showToast('画布操作失败，请先导出当前文件', 'error');
        })
        .finally(() => {
          boardActionRef.current = false;
          setBoardActionPending(false);
        });
    },
    [showToast],
  );

  useEffect(() => {
    setSaveState('saving');
    const document = currentDocument();
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistDocument(document)
        .then(async () => {
          await refreshBoards();
          if (activeBoardIdRef.current === document.id) setSaveState(settledSaveState);
        })
        .catch(() => {
          if (activeBoardIdRef.current === document.id) setSaveState('error');
          showToast('本地保存失败，请先导出文件', 'error');
        });
    }, 260);
    return cancelPendingSave;
  }, [
    cancelPendingSave,
    currentDocument,
    persistDocument,
    refreshBoards,
    settledSaveState,
    showToast,
  ]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      setNodes((current) => applyNodeChanges(changes, current));
    },
    [],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<CanvasEdge>[]) => {
      setEdges((current) => applyEdgeChanges(changes, current));
    },
    [],
  );

  const addNode = useCallback(
    (kind: CardKind, clientPoint?: { x: number; y: number }) => {
      const stage = document.querySelector('.canvas-stage')?.getBoundingClientRect();
      const point =
        clientPoint ??
        ({
          x: stage ? stage.left + stage.width / 2 : window.innerWidth / 2,
          y: stage ? stage.top + stage.height / 2 : window.innerHeight / 2,
        } as const);
      const flowPoint = flow.screenToFlowPosition(point);
      const node = createCardNode(kind, { x: flowPoint.x - 130, y: flowPoint.y - 72 });

      recordHistory();
      setMode('select');
      setNodes((current) => [
        ...current.map((item) => ({ ...item, selected: false })),
        { ...node, selected: true },
      ]);
      setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
    },
    [flow, recordHistory],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        return;
      }

      recordHistory();
      setEdges((current) =>
        addEdge<CanvasEdge>(
          {
            ...connection,
            id: crypto.randomUUID(),
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 16,
              height: 16,
              color: 'oklch(0.4 0.106 150)',
            },
          },
          current,
        ),
      );
    },
    [recordHistory],
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      recordHistory();
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
      );
    },
    [recordHistory],
  );

  const deleteEdge = useCallback(
    (edgeId: string) => {
      recordHistory();
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    },
    [recordHistory],
  );

  const deleteSelection = useCallback(() => {
    const selectedIds = new Set(nodes.filter((node) => node.selected).map((node) => node.id));
    const hasSelectedEdges = edges.some((edge) => edge.selected);
    if (!selectedIds.size && !hasSelectedEdges) return;

    recordHistory();
    setNodes((current) => current.filter((node) => !selectedIds.has(node.id)));
    setEdges((current) =>
      current.filter(
        (edge) =>
          !edge.selected && !selectedIds.has(edge.source) && !selectedIds.has(edge.target),
      ),
    );
  }, [edges, nodes, recordHistory]);

  const duplicateSelected = useCallback(() => {
    if (!selectedNodes.length) return;
    recordHistory();
    const duplicated = selectedNodes.map(duplicateNode);
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      ...duplicated.map((node) => ({ ...node, selected: true })),
    ]);
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
  }, [recordHistory, selectedNodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (boardActionRef.current) {
        const commandKey = event.ctrlKey || event.metaKey;
        if (
          event.key === 'Delete' ||
          event.key === 'Backspace' ||
          (commandKey && ['d', 'y', 'z'].includes(event.key.toLowerCase()))
        ) {
          event.preventDefault();
        }
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditing =
        target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;

      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
        return;
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))
      ) {
        event.preventDefault();
        redo();
        return;
      }

      if (isEditing) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelection();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
      } else if (event.key === 'Escape') {
        setNodes((current) => current.map((node) => ({ ...node, selected: false })));
        setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
        setQuery('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelection, duplicateSelected, redo, undo]);

  const updateSelectedNode = useCallback(
    (patch: Partial<CardData>, mergeKey: string) => {
      if (!selectedNode) return;
      recordHistory(`node:${selectedNode.id}:${mergeKey}`);
      setNodes((current) =>
        current.map((node) =>
          node.id === selectedNode.id
            ? { ...node, data: { ...node.data, ...patch } }
            : node,
        ),
      );
    },
    [recordHistory, selectedNode],
  );

  const updateSelectedEdge = useCallback(
    (patch: Pick<CanvasEdge, 'label' | 'type'>, mergeKey: string) => {
      if (!selectedEdge) return;
      recordHistory(`edge:${selectedEdge.id}:${mergeKey}`);
      setEdges((current) =>
        current.map((edge) =>
          edge.id === selectedEdge.id ? { ...edge, ...patch } : edge,
        ),
      );
    },
    [recordHistory, selectedEdge],
  );

  const reverseSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    recordHistory();
    setEdges((current) =>
      current.map((edge) =>
        edge.id === selectedEdge.id
          ? { ...edge, source: edge.target, target: edge.source }
          : edge,
      ),
    );
  }, [recordHistory, selectedEdge]);

  const changeSelectedNodesKind = useCallback(
    (kind: CardKind) => {
      if (!selectedNodes.length) return;
      recordHistory();
      const selectedIds = new Set(selectedNodes.map((node) => node.id));
      setNodes((current) =>
        current.map((node) =>
          selectedIds.has(node.id)
            ? {
                ...node,
                data: {
                  ...node.data,
                  kind,
                  status: kind === 'task' ? node.data.status ?? 'todo' : undefined,
                },
              }
            : node,
        ),
      );
    },
    [recordHistory, selectedNodes],
  );

  const closeInspector = useCallback(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
  }, []);

  const tidy = useCallback(() => {
    if (nodes.length < 2) return;
    recordHistory();
    setNodes(tidyNodes(nodes, edges));
    requestAnimationFrame(() => {
      void flow.fitView({ padding: 0.18, duration: 240, maxZoom: 1.15 });
    });
    showToast('布局已整理');
  }, [edges, flow, nodes, recordHistory, showToast]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return nodes
      .filter((node) => {
        const searchable = [
          node.data.title,
          node.data.body,
          node.data.url ?? '',
          ...(node.data.tags ?? []),
        ]
          .join(' ')
          .toLocaleLowerCase();
        return searchable.includes(normalized);
      })
      .slice(0, 6);
  }, [nodes, query]);

  const focusNode = useCallback(
    (node: CanvasNode) => {
      setNodes((current) =>
        current.map((item) => ({ ...item, selected: item.id === node.id })),
      );
      setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
      setQuery('');
      const width = node.measured?.width ?? 260;
      const height = node.measured?.height ?? 150;
      const zoom = 1.05;
      const compact = window.innerWidth <= 720;
      const inspectorOffsetX = compact ? 0 : 160 / zoom;
      const inspectorOffsetY = compact ? window.innerHeight * 0.24 / zoom : 0;
      void flow.setCenter(
        node.position.x + width / 2 + inspectorOffsetX,
        node.position.y + height / 2 + inspectorOffsetY,
        {
          zoom,
          duration: 260,
        },
      );
    },
    [flow],
  );

  const selectBoard = useCallback(
    (nextBoardId: string) => {
      if (nextBoardId === boardId) return;
      runBoardAction(async () => {
        await flushCurrentBoard();
        const document = await storage.getBoard(nextBoardId);
        if (!document) throw new Error(`Board not found: ${nextBoardId}`);
        await storage.setActiveBoardId(document.id);
        clearHistory();
        restoreDocument(document, true);
        await refreshBoards();
        setSaveState(settledSaveState);
      });
    },
    [
      boardId,
      clearHistory,
      flushCurrentBoard,
      refreshBoards,
      restoreDocument,
      runBoardAction,
      settledSaveState,
      storage,
    ],
  );

  const createBoard = useCallback(() => {
    const document = createBlankBoard(nextUntitledBoardTitle(boards));
    runBoardAction(async () => {
      await flushCurrentBoard();
      await storage.putBoardAndSetActive(document);
      clearHistory();
      restoreDocument(document, true);
      await refreshBoards();
      setSaveState(settledSaveState);
      showToast('已新建画布');
    });
  }, [
    boards,
    clearHistory,
    flushCurrentBoard,
    refreshBoards,
    restoreDocument,
    runBoardAction,
    settledSaveState,
    showToast,
    storage,
  ]);

  const deleteBoard = useCallback(
    (deleteBoardId: string) => {
      const summary = boards.find((board) => board.id === deleteBoardId);
      if (!summary) return;
      if (!window.confirm(`删除画布“${summary.title || '未命名画布'}”？此操作无法撤销。`)) {
        return;
      }

      runBoardAction(async () => {
        await flushCurrentBoard();

        if (deleteBoardId !== boardId) {
          await storage.deleteBoard(deleteBoardId);
        } else {
          const fallbackSummary = boards.find((board) => board.id !== deleteBoardId);
          if (fallbackSummary) {
            const fallback = await storage.getBoard(fallbackSummary.id);
            if (!fallback) throw new Error(`Board not found: ${fallbackSummary.id}`);
            await storage.deleteBoard(deleteBoardId);
            await storage.setActiveBoardId(fallback.id);
            clearHistory();
            restoreDocument(fallback, true);
          } else {
            const blank = createBlankBoard();
            await storage.putBoardAndSetActive(blank);
            await storage.deleteBoard(deleteBoardId);
            clearHistory();
            restoreDocument(blank, true);
          }
        }

        await refreshBoards();
        setSaveState(settledSaveState);
        showToast('画布已删除');
      });
    },
    [
      boardId,
      boards,
      clearHistory,
      flushCurrentBoard,
      refreshBoards,
      restoreDocument,
      runBoardAction,
      settledSaveState,
      showToast,
      storage,
    ],
  );

  const openImportedBoard = useCallback(
    (document: BoardDocument, successMessage: string) => {
      const collides = boards.some((board) => board.id === document.id);
      const imported: BoardDocument = {
        ...document,
        id: collides ? createBlankBoard().id : document.id,
        updatedAt: new Date().toISOString(),
      };

      runBoardAction(async () => {
        await flushCurrentBoard();
        await storage.putBoardAndSetActive(imported);
        clearHistory();
        restoreDocument(imported, true);
        await refreshBoards();
        setSaveState(settledSaveState);
        showToast(successMessage);
      });
    },
    [
      boards,
      clearHistory,
      flushCurrentBoard,
      refreshBoards,
      restoreDocument,
      runBoardAction,
      settledSaveState,
      showToast,
      storage,
    ],
  );

  const onFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      try {
        const text = await file.text();
        let document: BoardDocument;

        if (file.name.toLowerCase().endsWith('.canvas')) {
          document = importJsonCanvas(text, file.name.replace(/\.canvas$/i, ''));
        } else {
          const value: unknown = JSON.parse(text);
          try {
            document = parseBoardDocument(value);
          } catch {
            document = importJsonCanvas(value, file.name.replace(/\.json$/i, ''));
          }
        }

        openImportedBoard(document, `已导入 ${file.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '文件格式无法识别';
        showToast(message, 'error');
      }
    },
    [openImportedBoard, showToast],
  );

  const resetBoard = useCallback(() => {
    if (!window.confirm('恢复示例画布？当前画布仍可通过撤销找回。')) return;
    const starter = createStarterBoard();
    recordHistory();
    restoreDocument({ ...starter, id: boardId }, true);
    showToast('已恢复示例画布');
  }, [boardId, recordHistory, restoreDocument, showToast]);

  const onBoardTitleChange = useCallback(
    (nextTitle: string) => {
      recordHistory('board-title');
      setTitle(nextTitle);
      setBoards((current) =>
        current.map((board) =>
          board.id === boardId
            ? { ...board, title: nextTitle, updatedAt: new Date().toISOString() }
            : board,
        ),
      );
    },
    [boardId, recordHistory],
  );

  const onCanvasDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      const target = event.target as Element;
      if (!target.classList.contains('react-flow__pane')) return;
      addNode('note', { x: event.clientX, y: event.clientY });
    },
    [addNode],
  );

  const nodeTitles = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.title || '未命名'])),
    [nodes],
  );

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const relation = typeof edge.label === 'string' && edge.label.trim()
          ? edge.label
          : `${nodeTitles.get(edge.source) ?? '未命名'} 到 ${nodeTitles.get(edge.target) ?? '未命名'}`;
        return { ...edge, ariaLabel: `关系：${relation}` };
      }),
    [edges, nodeTitles],
  );

  return (
    <div
      className={`app-shell${hasInspector ? ' has-inspector' : ''}`}
      aria-busy={boardActionPending}
    >
      <div className="workspace-content" inert={boardActionPending ? true : undefined}>
        <TopBar
          boards={boards}
          activeBoardId={boardId}
          title={title}
          onTitleChange={onBoardTitleChange}
          onCreateBoard={createBoard}
          onSelectBoard={selectBoard}
          onDeleteBoard={deleteBoard}
          query={query}
          onQueryChange={setQuery}
          searchResults={searchResults}
          onSearchSelect={focusNode}
          canUndo={pastRef.current.length > 0}
          canRedo={futureRef.current.length > 0}
          onUndo={undo}
          onRedo={redo}
          onTidy={tidy}
          onExportNative={() => {
            downloadText(
              `${fileStem(title)}.nodefield.json`,
              JSON.stringify(currentDocument(), null, 2),
            );
            showToast('Nodefield 文件已导出');
          }}
          onExportCanvas={() => {
            downloadText(`${fileStem(title)}.canvas`, exportJsonCanvas(currentDocument()));
            showToast('JSON Canvas 文件已导出');
          }}
          onImport={() => fileInputRef.current?.click()}
          onReset={resetBoard}
          saveState={saveState}
        />

        <main className="canvas-stage" onDoubleClick={onCanvasDoubleClick}>
          <ReactFlow<CanvasNode, CanvasEdge>
            nodes={nodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={() => recordHistory()}
            onMoveEnd={(_, nextViewport) => setViewportState(nextViewport)}
            defaultViewport={initialBoard.viewport}
            minZoom={0.15}
            maxZoom={2.4}
            panOnDrag={mode === 'pan' ? true : [1, 2]}
            selectionOnDrag={mode === 'select'}
            nodesDraggable={mode === 'select'}
            elementsSelectable
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            multiSelectionKeyCode="Shift"
            panActivationKeyCode="Space"
            connectionLineStyle={{ stroke: 'oklch(0.4 0.106 150)', strokeWidth: 2 }}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 16,
                height: 16,
                color: 'oklch(0.4 0.106 150)',
              },
            }}
            fitViewOptions={{ padding: 0.18, maxZoom: 1.15 }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="oklch(0.8 0.014 150)"
              gap={24}
              size={1.2}
            />
            <MiniMap
              position="bottom-left"
              pannable
              zoomable
              nodeStrokeWidth={2}
              nodeBorderRadius={4}
              nodeColor={(node) => CARD_META[(node as CanvasNode).data.kind].soft}
              nodeStrokeColor={(node) => CARD_META[(node as CanvasNode).data.kind].color}
              maskColor="oklch(0.97 0.006 150 / 0.72)"
            />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>

          <ToolDock mode={mode} onModeChange={setMode} onAdd={addNode} />
        </main>

        {selectedNode ? (
          <Inspector
            node={selectedNode}
            onClose={closeInspector}
            onChange={updateSelectedNode}
            onDuplicate={duplicateSelected}
            onDelete={() => deleteNode(selectedNode.id)}
          />
        ) : null}

        {selectedEdge ? (
          <EdgeInspector
            edge={selectedEdge}
            sourceTitle={nodeTitles.get(selectedEdge.source) ?? '未命名'}
            targetTitle={nodeTitles.get(selectedEdge.target) ?? '未命名'}
            onClose={closeInspector}
            onChange={updateSelectedEdge}
            onReverse={reverseSelectedEdge}
            onDelete={() => deleteEdge(selectedEdge.id)}
          />
        ) : null}

        {hasBatchSelection ? (
          <SelectionInspector
            nodes={selectedNodes}
            edgeCount={selectedEdges.length}
            onClose={closeInspector}
            onChangeKind={changeSelectedNodesKind}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelection}
          />
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.canvas,application/json"
          hidden
          onChange={onFileChange}
        />
      </div>
      <Toast message={toast} onDismiss={() => setToast(null)} />
      {boardActionPending ? (
        <div className="workspace-blocker" role="status" aria-live="polite">
          <span className="visually-hidden">正在切换画布</span>
        </div>
      ) : null}
    </div>
  );
}
