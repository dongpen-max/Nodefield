import { Copy, ListChecks, Trash2, X } from 'lucide-react';
import type { CardKind, CanvasNode } from '../types/board';
import { CARD_META } from './cardMeta';

interface SelectionInspectorProps {
  nodes: CanvasNode[];
  edgeCount: number;
  onClose: () => void;
  onChangeKind: (kind: CardKind) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const kinds = Object.keys(CARD_META) as CardKind[];

export default function SelectionInspector({
  nodes,
  edgeCount,
  onClose,
  onChangeKind,
  onDuplicate,
  onDelete,
}: SelectionInspectorProps) {
  const total = nodes.length + edgeCount;
  const onlyKind = nodes.length && nodes.every((node) => node.data.kind === nodes[0].data.kind)
    ? nodes[0].data.kind
    : null;

  return (
    <aside className="inspector" aria-label="批量检查器">
      <header className="inspector__header">
        <div>
          <span className="inspector__eyeline">
            <ListChecks size={15} aria-hidden="true" />
            批量操作
          </span>
          <h2>已选择 {total} 项</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="关闭检查器"
          data-tooltip="关闭"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="inspector__body">
        <div className="selection-summary" aria-label="选择摘要">
          <span>
            <strong>{nodes.length}</strong>
            节点
          </span>
          <span>
            <strong>{edgeCount}</strong>
            关系
          </span>
        </div>

        {nodes.length ? (
          <fieldset className="field-group">
            <legend>统一类型</legend>
            <div className="type-segments">
              {kinds.map((kind) => {
                const meta = CARD_META[kind];
                const Icon = meta.icon;
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-label={`将所选节点设为${meta.label}`}
                    aria-pressed={onlyKind === kind}
                    className={onlyKind === kind ? 'is-active' : ''}
                    title={meta.label}
                    onClick={() => onChangeKind(kind)}
                  >
                    <span style={{ background: meta.color }} aria-hidden="true" />
                    <Icon size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
      </div>

      <footer className="inspector__actions" role="toolbar" aria-label="批量操作">
        {nodes.length ? (
          <button className="secondary-button" type="button" onClick={onDuplicate}>
            <Copy size={16} aria-hidden="true" />
            复制节点
          </button>
        ) : null}
        <button className="danger-button" type="button" onClick={onDelete}>
          <Trash2 size={16} aria-hidden="true" />
          删除所选
        </button>
      </footer>
    </aside>
  );
}
