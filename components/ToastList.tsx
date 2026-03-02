import React from 'react';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const STYLES: Record<ToastItem['type'], string> = {
  success: 'bg-emerald-500 text-slate-950',
  error:   'bg-red-500 text-white',
  info:    'bg-slate-800 text-slate-200 border border-white/10',
};

const ICONS: Record<ToastItem['type'], string> = {
  success: '✓',
  error:   '✕',
  info:    '•',
};

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export const ToastList: React.FC<Props> = ({ toasts, onDismiss }) => (
  <div className="fixed bottom-8 right-8 z-50 flex flex-col gap-3 items-end pointer-events-none">
    {toasts.map(t => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl font-bold text-xs uppercase tracking-widest max-w-sm animate-fade-in ${STYLES[t.type]}`}
      >
        <span className="text-base leading-none font-black">{ICONS[t.type]}</span>
        <span className="flex-1 leading-relaxed normal-case font-medium text-[11px] tracking-wide">{t.message}</span>
        <button
          onClick={() => onDismiss(t.id)}
          className="opacity-60 hover:opacity-100 transition-opacity text-base leading-none ml-2"
        >
          ×
        </button>
      </div>
    ))}
  </div>
);
