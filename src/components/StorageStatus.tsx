import { Database, TriangleAlert } from 'lucide-react';

export interface StorageStatusData {
  persistent: boolean;
  lastSavedAt: string | null;
  lastBackupAt: string | null;
  usage: number | null;
  quota: number | null;
}

interface StorageStatusProps {
  status: StorageStatusData;
}

function formatBytes(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return '容量未知';
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(1)} GB`;
}

function formatMoment(value: string | null, empty: string): string {
  if (!value) return empty;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return empty;

  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  return new Intl.DateTimeFormat('zh-CN',
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  ).format(date);
}

export default function StorageStatus({ status }: StorageStatusProps) {
  const usage = status.quota
    ? `${formatBytes(status.usage)} / ${formatBytes(status.quota)}`
    : formatBytes(status.usage);

  return (
    <section
      className={`storage-status${status.persistent ? '' : ' storage-status--warning'}`}
      aria-label="本地存储状态"
    >
      <header>
        {status.persistent ? (
          <Database size={15} aria-hidden="true" />
        ) : (
          <TriangleAlert size={15} aria-hidden="true" />
        )}
        <strong>{status.persistent ? 'IndexedDB' : '仅此页面'}</strong>
        <span>{status.persistent ? usage : '刷新会丢失'}</span>
      </header>
      <dl>
        <div>
          <dt>最近保存</dt>
          <dd>{formatMoment(status.lastSavedAt, '尚未保存')}</dd>
        </div>
        <div>
          <dt>最近备份</dt>
          <dd>{formatMoment(status.lastBackupAt, '尚未备份')}</dd>
        </div>
      </dl>
    </section>
  );
}
