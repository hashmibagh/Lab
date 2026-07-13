import { classNames } from '../../lib/utils';

export default function StatCard({ label, value, icon: Icon, trend, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200'
  };
  return (
    <div className="glass-card p-4 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-display font-semibold mt-1 text-slate-900 dark:text-white">{value}</p>
        {trend && <p className="text-xs mt-1 text-slate-400">{trend}</p>}
      </div>
      {Icon && (
        <div className={classNames('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tones[tone])}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}
