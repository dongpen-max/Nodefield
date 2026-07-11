import { useRef } from 'react';
import {
  AlignHorizontalDistributeCenter,
  Check,
  Download,
  FileInput,
  FileJson,
  HardDrive,
  MoreHorizontal,
  Redo2,
  RotateCcw,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import type { CanvasNode } from '../types/board';
import { CARD_META } from './cardMeta';

interface TopBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  searchResults: CanvasNode[];
  onSearchSelect: (node: CanvasNode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onTidy: () => void;
  onExportNative: () => void;
  onExportCanvas: () => void;
  onImport: () => void;
  onReset: () => void;
  saveState: 'saving' | 'saved';
}

export default function TopBar({
  title,
  onTitleChange,
  query,
  onQueryChange,
  searchResults,
  onSearchSelect,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onTidy,
  onExportNative,
  onExportCanvas,
  onImport,
  onReset,
  saveState,
}: TopBarProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute('open');

  return (
    <header className="top-bar">
      <div className="brand-lockup" aria-label="Nodefield">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <strong>Nodefield</strong>
      </div>

      <input
        className="board-title"
        aria-label="画布名称"
        value={title}
        maxLength={80}
        onChange={(event) => onTitleChange(event.target.value)}
      />

      <div className="search-control">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="搜索节点"
          placeholder="搜索节点"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query ? (
          <button type="button" aria-label="清除搜索" onClick={() => onQueryChange('')}>
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}
        {query ? (
          <div className="search-results" role="listbox" aria-label="搜索结果">
            {searchResults.length ? (
              searchResults.map((node) => {
                const meta = CARD_META[node.data.kind];
                const Icon = meta.icon;
                return (
                  <button
                    key={node.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => onSearchSelect(node)}
                  >
                    <span style={{ background: meta.soft, color: meta.color }}>
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{node.data.title || '未命名'}</strong>
                      <small>{meta.label}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <p>没有匹配节点</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="save-indicator" aria-live="polite">
        {saveState === 'saved' ? <Check size={13} aria-hidden="true" /> : <HardDrive size={13} />}
        <span>{saveState === 'saved' ? '已保存' : '保存中'}</span>
      </div>

      <div className="top-bar__actions">
        <button
          className="icon-button"
          type="button"
          aria-label="撤销"
          data-tooltip="撤销"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={17} aria-hidden="true" />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="重做"
          data-tooltip="重做"
          disabled={!canRedo}
          onClick={onRedo}
        >
          <Redo2 size={17} aria-hidden="true" />
        </button>
        <button
          className="icon-button desktop-action"
          type="button"
          aria-label="整理布局"
          data-tooltip="整理布局"
          onClick={onTidy}
        >
          <AlignHorizontalDistributeCenter size={17} aria-hidden="true" />
        </button>
        <details className="file-menu" ref={menuRef}>
          <summary className="icon-button" aria-label="文件菜单" data-tooltip="文件">
            <MoreHorizontal size={18} aria-hidden="true" />
          </summary>
          <div className="file-menu__panel">
            <button
              type="button"
              onClick={() => {
                onExportNative();
                closeMenu();
              }}
            >
              <Download size={16} aria-hidden="true" />
              导出 Nodefield
            </button>
            <button
              type="button"
              onClick={() => {
                onExportCanvas();
                closeMenu();
              }}
            >
              <FileJson size={16} aria-hidden="true" />
              导出 JSON Canvas
            </button>
            <button
              type="button"
              onClick={() => {
                onImport();
                closeMenu();
              }}
            >
              <FileInput size={16} aria-hidden="true" />
              导入文件
            </button>
            <span aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                onTidy();
                closeMenu();
              }}
            >
              <AlignHorizontalDistributeCenter size={16} aria-hidden="true" />
              整理布局
            </button>
            <button
              className="is-danger"
              type="button"
              onClick={() => {
                onReset();
                closeMenu();
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              恢复示例画布
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}
