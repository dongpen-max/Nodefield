import { useRef } from 'react';
import { Check, ChevronDown, Layers3, Plus, Trash2 } from 'lucide-react';
import type { BoardSummary } from '../lib/storage';
import { useDismissableDetails } from './useDismissableDetails';

interface BoardSwitcherProps {
  boards: BoardSummary[];
  activeBoardId: string;
  title: string;
  onTitleChange: (title: string) => void;
  onCreate: () => void;
  onSelect: (boardId: string) => void;
  onDelete: (boardId: string) => void;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function BoardSwitcher({
  boards,
  activeBoardId,
  title,
  onTitleChange,
  onCreate,
  onSelect,
  onDelete,
}: BoardSwitcherProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useDismissableDetails(detailsRef);
  const close = () => detailsRef.current?.removeAttribute('open');

  return (
    <details className="board-switcher" ref={detailsRef}>
      <summary aria-label={`切换画布，当前为${title || '未命名画布'}`}>
        <Layers3 size={16} aria-hidden="true" />
        <span>{title || '未命名画布'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </summary>

      <div className="board-switcher__panel">
        <header>
          <strong>画布</strong>
          <button
            className="secondary-button board-switcher__create"
            type="button"
            onClick={() => {
              onCreate();
              close();
            }}
          >
            <Plus size={15} aria-hidden="true" />
            新建画布
          </button>
        </header>

        <nav className="board-list" aria-label="画布列表">
          {boards.map((board) => {
            const active = board.id === activeBoardId;
            return (
              <div className={`board-list__row${active ? ' is-active' : ''}`} key={board.id}>
                <button
                  className="board-list__select"
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    onSelect(board.id);
                    close();
                  }}
                >
                  <span>
                    <strong>{board.title || '未命名画布'}</strong>
                    <small>{formatUpdatedAt(board.updatedAt)}</small>
                  </span>
                  {active ? <Check size={15} aria-hidden="true" /> : null}
                </button>
                <button
                  className="board-list__delete"
                  type="button"
                  aria-label={`删除画布 ${board.title || '未命名画布'}`}
                  title="删除画布"
                  onClick={() => {
                    onDelete(board.id);
                    close();
                  }}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </nav>

        <label className="field-group board-switcher__rename">
          <span>当前画布名称</span>
          <input
            aria-label="当前画布名称"
            value={title}
            maxLength={80}
            onChange={(event) => onTitleChange(event.target.value)}
          />
        </label>
      </div>
    </details>
  );
}
