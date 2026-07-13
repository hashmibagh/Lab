import { AlertTriangle, Inbox } from 'lucide-react';
import Modal from './Modal';

export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', description, danger = true, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} width="max-w-sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
            {loading ? 'Working…' : 'Confirm'}
          </button>
        </>
      }>
      <div className="flex gap-3 text-sm text-slate-600 dark:text-slate-300">
        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
        <p>{description}</p>
      </div>
    </Modal>
  );
}

export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-3">
        <Inbox className="text-slate-400" size={22} />
      </div>
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="animate-pulse divide-y divide-slate-100 dark:divide-white/5">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, c) => (
            <div key={c} className="h-4 bg-slate-200 dark:bg-white/10 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
