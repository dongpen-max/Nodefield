import type { LucideIcon } from 'lucide-react';
import { CheckSquare, FileText, Lightbulb, Link } from 'lucide-react';
import type { CardKind, TaskStatus } from '../types/board';

export interface CardMeta {
  label: string;
  icon: LucideIcon;
  color: string;
  soft: string;
}

export const CARD_META: Record<CardKind, CardMeta> = {
  note: {
    label: '笔记',
    icon: FileText,
    color: 'oklch(0.63 0.12 82)',
    soft: 'oklch(0.965 0.025 82)',
  },
  source: {
    label: '来源',
    icon: Link,
    color: 'oklch(0.52 0.14 245)',
    soft: 'oklch(0.955 0.025 245)',
  },
  insight: {
    label: '洞察',
    icon: Lightbulb,
    color: 'oklch(0.58 0.18 32)',
    soft: 'oklch(0.955 0.03 32)',
  },
  task: {
    label: '行动',
    icon: CheckSquare,
    color: 'oklch(0.4 0.106 150)',
    soft: 'oklch(0.95 0.028 150)',
  },
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: '待处理',
  doing: '进行中',
  done: '已完成',
};
