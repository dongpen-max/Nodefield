import { FilePlus2 } from 'lucide-react';

interface CanvasEmptyStateProps {
  onCreateNote: () => void;
}

export default function CanvasEmptyState({ onCreateNote }: CanvasEmptyStateProps) {
  return (
    <section className="canvas-empty" aria-label="空画布引导">
      <div>
        <strong>从第一张卡片开始</strong>
        <p>先记录一个问题、来源或下一步，再把它们连接起来。</p>
        <button type="button" onClick={onCreateNote}>
          <FilePlus2 size={16} aria-hidden="true" />
          添加第一张笔记
        </button>
        <small>
          <span className="canvas-empty__desktop-hint">也可双击画布空白处快速添加</span>
          <span className="canvas-empty__mobile-hint">也可从下方工具栏选择卡片类型</span>
        </small>
      </div>
    </section>
  );
}
