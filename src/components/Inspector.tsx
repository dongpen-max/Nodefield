import { Copy, Trash2, X } from 'lucide-react';
import type { CardData, CardKind, CanvasNode, TaskStatus } from '../types/board';
import { CARD_META, TASK_STATUS_LABELS } from './cardMeta';

interface InspectorProps {
  node: CanvasNode;
  onClose: () => void;
  onChange: (patch: Partial<CardData>, mergeKey: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const kinds = Object.keys(CARD_META) as CardKind[];
const statuses = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];

export default function Inspector({
  node,
  onClose,
  onChange,
  onDuplicate,
  onDelete,
}: InspectorProps) {
  const { data } = node;
  const currentMeta = CARD_META[data.kind];
  const CurrentIcon = currentMeta.icon;

  return (
    <aside className="inspector" aria-label="节点检查器">
      <header className="inspector__header">
        <div>
          <span className="inspector__eyeline">
            <CurrentIcon size={15} aria-hidden="true" />
            {currentMeta.label}
          </span>
          <h2>{data.title || '未命名'}</h2>
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
        <fieldset className="field-group">
          <legend>类型</legend>
          <div className="type-segments">
            {kinds.map((kind) => {
              const meta = CARD_META[kind];
              const Icon = meta.icon;
              return (
                <button
                  key={kind}
                  type="button"
                  aria-label={meta.label}
                  aria-pressed={data.kind === kind}
                  className={data.kind === kind ? 'is-active' : ''}
                  title={meta.label}
                  onClick={() =>
                    onChange(
                      {
                        kind,
                        status: kind === 'task' ? data.status ?? 'todo' : undefined,
                      },
                      'kind',
                    )
                  }
                >
                  <span style={{ background: meta.color }} aria-hidden="true" />
                  <Icon size={16} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="field-group">
          <span>标题</span>
          <input
            value={data.title}
            maxLength={120}
            onChange={(event) => onChange({ title: event.target.value }, 'title')}
          />
        </label>

        <label className="field-group">
          <span>内容</span>
          <textarea
            value={data.body}
            rows={8}
            maxLength={4000}
            onChange={(event) => onChange({ body: event.target.value }, 'body')}
          />
        </label>

        {data.kind === 'source' ? (
          <label className="field-group">
            <span>链接</span>
            <input
              type="url"
              value={data.url ?? ''}
              placeholder="https://"
              onChange={(event) => onChange({ url: event.target.value }, 'url')}
            />
          </label>
        ) : null}

        {data.kind === 'task' ? (
          <label className="field-group">
            <span>状态</span>
            <select
              value={data.status ?? 'todo'}
              onChange={(event) =>
                onChange({ status: event.target.value as TaskStatus }, 'status')
              }
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field-group">
          <span>标签</span>
          <input
            value={(data.tags ?? []).join(', ')}
            placeholder="研究, 证据"
            onChange={(event) =>
              onChange(
                {
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim().replace(/^#/, ''))
                    .filter(Boolean)
                    .slice(0, 8),
                },
                'tags',
              )
            }
          />
        </label>
      </div>

      <footer className="inspector__actions">
        <button className="secondary-button" type="button" onClick={onDuplicate}>
          <Copy size={16} aria-hidden="true" />
          复制
        </button>
        <button className="danger-button" type="button" onClick={onDelete}>
          <Trash2 size={16} aria-hidden="true" />
          删除
        </button>
      </footer>
    </aside>
  );
}
