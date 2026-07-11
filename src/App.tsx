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
import Inspector from './components/Inspector';
import Toast, { type ToastMessage } from './components/Toast';
import ToolDock, { type CanvasMode } from './components/ToolDock';
import TopBar from './components/TopBar';
import { CARD_META } from './components/cardMeta';
import { createStarterBoard } from './data/starterBoard';
import { createCardNode, duplicateNode, parseBoardDocument, tidyNodes } from './lib/board';
import { exportJsonCanvas, importJsonCanvas } from './lib/jsonCanvas';
import { loadBoard, saveBoard } from './lib/storage';
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function initialDocument() {
  try {
    return loadBoard() ?? createStarterBoard();
  } catch {
    return createStarterBoard();
  }
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

export default function App() {
  const initialRef = useRef<BoardDocument | null>(null);
  if (!initialRef.current) initialRef.current = initialDocument();

  const initial = initialRef.current;
  const flow = useReactFlow<CanvasNode, CanvasEdge>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pastRef = useRef<BoardDocument[]>([]);
  const futureRef = useRef<BoardDocument[]>([]);
  const lastMergeRef = useRef<MergeState | null>(null);

  const [boardId, setBoardId] = useState(initial.id);
  const [title, setTitle] = useState(initial.title);
  const [nodes, setNodes] = useState<CanvasNode[]>(() => clone(initial.nodes));
  const [edges, setEdges] = useState<CanvasEdge[]>(() => clone(initial.edges));
  const [viewport, setViewportState] = useState<Viewport>(initial.viewport);
  const [mode, setMode] = useState<CanvasMode>('select');
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState<'saving' | 'saved'>('saved');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [, setHistoryRevision] = useState(0);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.selected) ?? null,
    [nodes],
  );

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

  useEffect(() => {
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      try {
        saveBoard(currentDocument());
        setSaveState('saved');
      } catch {
        setSaveState('saved');
        showToast('本地保存失败，请先导出文件', 'error');
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [currentDocument, showToast]);

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
    if (!selectedNode) return;
    recordHistory();
    const duplicated = duplicateNode(selectedNode);
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      { ...duplicated, selected: true },
    ]);
  }, [recordHistory, selectedNode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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

  const closeInspector = useCallback(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
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
      void flow.setCenter(node.position.x + width / 2, node.position.y + height / 2, {
        zoom: 1.05,
        duration: 260,
      });
    },
    [flow],
  );

  const replaceWithDocument = useCallback(
    (document: BoardDocument, successMessage: string) => {
      recordHistory();
      restoreDocument(document, true);
      showToast(successMessage);
    },
    [recordHistory, restoreDocument, showToast],
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

        replaceWithDocument(document, `已导入 ${file.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : '文件格式无法识别';
        showToast(message, 'error');
      }
    },
    [replaceWithDocument, showToast],
  );

  const resetBoard = useCallback(() => {
    if (!window.confirm('恢复示例画布？当前画布仍可通过撤销找回。')) return;
    replaceWithDocument(createStarterBoard(), '已恢复示例画布');
  }, [replaceWithDocument]);

  const onBoardTitleChange = useCallback(
    (nextTitle: string) => {
      recordHistory('board-title');
      setTitle(nextTitle);
    },
    [recordHistory],
  );

  const onCanvasDoubleClick = useCallback(
    (event: ReactMouseEvent) => {
      const target = event.target as Element;
      if (!target.classList.contains('react-flow__pane')) return;
      addNode('note', { x: event.clientX, y: event.clientY });
    },
    [addNode],
  );

  return (
    <div className={`app-shell${selectedNode ? ' has-inspector' : ''}`}>
      <TopBar
        title={title}
        onTitleChange={onBoardTitleChange}
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
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={() => recordHistory()}
          onMoveEnd={(_, nextViewport) => setViewportState(nextViewport)}
          defaultViewport={initial.viewport}
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.canvas,application/json"
        hidden
        onChange={onFileChange}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
