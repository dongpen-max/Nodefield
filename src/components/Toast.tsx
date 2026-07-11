import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  id: number;
  tone: 'success' | 'error';
  text: string;
}

interface ToastProps {
  message: ToastMessage | null;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: ToastProps) {
  if (!message) return null;

  const Icon = message.tone === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div className={`toast toast--${message.tone}`} role="status" aria-live="polite">
      <Icon size={17} aria-hidden="true" />
      <span>{message.text}</span>
      <button type="button" aria-label="关闭通知" onClick={onDismiss}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
