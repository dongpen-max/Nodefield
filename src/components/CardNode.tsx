import type { CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Check, ExternalLink } from 'lucide-react';
import type { CanvasNode } from '../types/board';
import { CARD_META, TASK_STATUS_LABELS } from './cardMeta';

function hostname(url?: string) {
  if (!url) return '';

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function CardNode({ data, selected }: NodeProps<CanvasNode>) {
  const meta = CARD_META[data.kind];
  const Icon = meta.icon;
  const style = {
    '--node-accent': meta.color,
    '--node-soft': meta.soft,
  } as CSSProperties;

  return (
    <article
      className={`canvas-card${selected ? ' is-selected' : ''}${
        data.status === 'done' ? ' is-complete' : ''
      }`}
      style={style}
      aria-label={`${meta.label}：${data.title || '未命名'}`}
    >
      <Handle className="canvas-card__handle" type="target" position={Position.Left} />
      <header className="canvas-card__meta">
        <span className="canvas-card__kind">
          <span className="canvas-card__swatch" aria-hidden="true" />
          <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
          {meta.label}
        </span>
        {data.kind === 'task' && data.status ? (
          <span className="canvas-card__status">
            {data.status === 'done' ? <Check size={12} aria-hidden="true" /> : null}
            {TASK_STATUS_LABELS[data.status]}
          </span>
        ) : null}
      </header>

      <h2>{data.title || '未命名'}</h2>
      {data.body ? <p>{data.body}</p> : null}

      {data.kind === 'source' && data.url ? (
        <span className="canvas-card__source">
          <ExternalLink size={12} aria-hidden="true" />
          {hostname(data.url)}
        </span>
      ) : null}

      {data.tags?.length ? (
        <footer className="canvas-card__tags">
          {data.tags.slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </footer>
      ) : null}
      <Handle className="canvas-card__handle" type="source" position={Position.Right} />
    </article>
  );
}
