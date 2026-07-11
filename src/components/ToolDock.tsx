import {
  CheckSquare,
  FileText,
  Hand,
  Lightbulb,
  Link,
  MousePointer2,
} from 'lucide-react';
import type { CardKind } from '../types/board';

export type CanvasMode = 'select' | 'pan';

interface ToolDockProps {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  onAdd: (kind: CardKind) => void;
}

const cardTools = [
  { kind: 'note' as const, label: '添加笔记', icon: FileText },
  { kind: 'source' as const, label: '添加来源', icon: Link },
  { kind: 'insight' as const, label: '添加洞察', icon: Lightbulb },
  { kind: 'task' as const, label: '添加行动', icon: CheckSquare },
];

export default function ToolDock({ mode, onModeChange, onAdd }: ToolDockProps) {
  return (
    <nav className="tool-dock" aria-label="画布工具">
      <div className="tool-dock__modes" aria-label="画布模式">
        <button
          className={mode === 'select' ? 'is-active' : ''}
          type="button"
          aria-label="选择模式"
          aria-pressed={mode === 'select'}
          data-tooltip="选择"
          onClick={() => onModeChange('select')}
        >
          <MousePointer2 size={18} aria-hidden="true" />
        </button>
        <button
          className={mode === 'pan' ? 'is-active' : ''}
          type="button"
          aria-label="移动画布模式"
          aria-pressed={mode === 'pan'}
          data-tooltip="移动画布"
          onClick={() => onModeChange('pan')}
        >
          <Hand size={18} aria-hidden="true" />
        </button>
      </div>
      <span className="tool-dock__divider" aria-hidden="true" />
      {cardTools.map(({ kind, label, icon: Icon }) => (
        <button
          key={kind}
          type="button"
          aria-label={label}
          data-tooltip={label}
          onClick={() => onAdd(kind)}
        >
          <Icon size={18} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
