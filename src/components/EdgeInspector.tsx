import { ArrowLeftRight, ArrowRight, GitBranch, Trash2, X } from 'lucide-react';
import { EDGE_PATHS, type CanvasEdge, type EdgePath } from '../types/board';

const EDGE_PATH_LABELS: Record<EdgePath, string> = {
  smoothstep: '圆角折线',
  default: '曲线',
  straight: '直线',
  step: '直角折线',
  simplebezier: '简化曲线',
};

interface EdgeInspectorProps {
  edge: CanvasEdge;
  sourceTitle: string;
  targetTitle: string;
  onClose: () => void;
  onChange: (patch: Pick<CanvasEdge, 'label' | 'type'>, mergeKey: string) => void;
  onReverse: () => void;
  onDelete: () => void;
}

export default function EdgeInspector({
  edge,
  sourceTitle,
  targetTitle,
  onClose,
  onChange,
  onReverse,
  onDelete,
}: EdgeInspectorProps) {
  const label = typeof edge.label === 'string' ? edge.label : '';
  const path = edge.type ?? 'smoothstep';
  const customPath = !(EDGE_PATHS as readonly string[]).includes(path);

  return (
    <aside className="inspector" aria-label="边检查器">
      <header className="inspector__header">
        <div>
          <span className="inspector__eyeline">
            <GitBranch size={15} aria-hidden="true" />
            关系
          </span>
          <h2>{label || '未命名关系'}</h2>
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
        <div className="edge-endpoints" aria-label="关系方向">
          <span>{sourceTitle || '未命名'}</span>
          <ArrowRight size={15} aria-hidden="true" />
          <span>{targetTitle || '未命名'}</span>
        </div>

        <label className="field-group">
          <span>标签</span>
          <input
            aria-label="关系标签"
            value={label}
            maxLength={120}
            placeholder="例如：支持、引发、依赖"
            onChange={(event) =>
              onChange({ label: event.target.value, type: path }, 'label')
            }
          />
        </label>

        <label className="field-group">
          <span>路径</span>
          <select
            aria-label="关系路径"
            value={path}
            onChange={(event) =>
              onChange({ label, type: event.target.value }, 'type')
            }
          >
            {customPath ? <option value={path}>自定义路径</option> : null}
            {EDGE_PATHS.map((value) => (
              <option key={value} value={value}>
                {EDGE_PATH_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <footer className="inspector__actions">
        <button className="secondary-button" type="button" onClick={onReverse}>
          <ArrowLeftRight size={16} aria-hidden="true" />
          反转方向
        </button>
        <button className="danger-button" type="button" onClick={onDelete}>
          <Trash2 size={16} aria-hidden="true" />
          删除
        </button>
      </footer>
    </aside>
  );
}
