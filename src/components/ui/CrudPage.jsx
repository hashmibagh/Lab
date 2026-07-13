import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Download, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import { ConfirmDialog, EmptyState, TableSkeleton } from './Feedback';
import FileUpload from './FileUpload';
import { exportToExcel, exportToPdf, formatDate } from '../../lib/utils';

/**
 * columns: [{ key, label, type: 'text'|'number'|'date'|'textarea'|'boolean'|'select'|'file',
 *              options?: [{value,label}], required?, hideInTable?, minRole?,
 *              bucket?, folder?, fileKind?: 'image'|'file' }]  // for type: 'file'
 */
export default function CrudPage({ title, table, columns, searchKeys = [], minRoleWrite = 'manager', pageSize = 10 }) {
  const { hasRole, profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const hasDeletedAt = useMemo(() => columns.some((c) => c.key === '__soft_delete__'), [columns]);
  const canWrite = hasRole(minRoleWrite);

  const load = async () => {
    setLoading(true);
    let q = supabase.from(table).select('*').order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
  }, [rows, query, searchKeys]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openCreate = () => { setEditing(null); setForm(defaultForm()); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm(row); setModalOpen(true); };

  function defaultForm() {
    const f = {};
    columns.forEach((c) => { f[c.key] = c.type === 'boolean' ? (c.default ?? true) : (c.default ?? ''); });
    return f;
  }

  const save = async () => {
    setSaving(true);
    const payload = { ...form };
    delete payload.id; delete payload.created_at; delete payload.updated_at;
    let error;
    if (editing) {
      ({ error } = await supabase.from(table).update(payload).eq('id', editing.id));
    } else {
      ({ error } = await supabase.from(table).insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? 'Updated successfully' : 'Added successfully');
    setModalOpen(false);
    load();
  };

  const remove = async () => {
    if (!confirmTarget) return;
    const { error } = await supabase.from(table).delete().eq('id', confirmTarget.id);
    if (error) return toast.error(error.message);
    toast.success('Deleted');
    setConfirmTarget(null);
    load();
  };

  const doExportExcel = () => exportToExcel(filtered, `${table}.xlsx`);
  const doExportPdf = () =>
    exportToPdf({
      title,
      head: columns.filter((c) => !c.hideInTable).map((c) => c.label),
      body: filtered.map((r) => columns.filter((c) => !c.hideInTable).map((c) => formatCell(r, c))),
      filename: `${table}.pdf`
    });

  function formatCell(row, col) {
    const v = row[col.key];
    if (col.type === 'boolean') return v ? 'Yes' : 'No';
    if (col.type === 'date') return formatDate(v);
    if (col.type === 'file') return v ? '📎 Attached' : '—';
    return v ?? '';
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={doExportExcel}><FileSpreadsheet size={16}/> Excel</button>
          <button className="btn-secondary" onClick={doExportPdf}><Download size={16}/> PDF</button>
          {canWrite && <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Add New</button>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-white/10">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className="input !pl-9" placeholder={`Search ${title.toLowerCase()}...`}
              value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
          </div>
        </div>

        {loading ? (
          <TableSkeleton cols={columns.length + 1} />
        ) : filtered.length === 0 ? (
          <EmptyState title={`No ${title.toLowerCase()} yet`} description="Add your first record to get started."
            action={canWrite && <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Add New</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                  {columns.filter((c) => !c.hideInTable).map((c) => (
                    <th key={c.key} className="px-4 py-2.5 font-medium">{c.label}</th>
                  ))}
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {paged.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                    {columns.filter((c) => !c.hideInTable).map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                        {formatCell(row, c)}
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <button className="btn-ghost !p-1.5 rounded-lg" onClick={() => openEdit(row)} aria-label="Edit">
                            <Pencil size={15} />
                          </button>
                        )}
                        {hasRole('super_admin') && (
                          <button className="btn-ghost !p-1.5 rounded-lg text-red-500" onClick={() => setConfirmTarget(row)} aria-label="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-white/10 text-sm">
            <span className="text-slate-500">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button className="btn-secondary !px-3 !py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button className="btn-secondary !px-3 !py-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${title}` : `Add ${title}`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {columns.map((c) => (
            <FieldInput key={c.key} col={c} value={form[c.key]}
              onChange={(v) => setForm((f) => ({ ...f, [c.key]: v }))} />
          ))}
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={remove}
        title="Delete record?" description={`This will permanently delete "${confirmTarget?.name ?? confirmTarget?.title ?? 'this record'}". This cannot be undone.`} />
    </div>
  );
}

function FieldInput({ col, value, onChange }) {
  const wide = col.type === 'textarea' || col.type === 'file';
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      {col.type !== 'file' && <label className="label">{col.label}{col.required && ' *'}</label>}
      {col.type === 'file' ? (
        <FileUpload bucket={col.bucket} folder={col.folder} kind={col.fileKind ?? 'file'} label={col.label}
          value={value} onChange={onChange} />
      ) : col.type === 'textarea' ? (
        <textarea className="input" rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      ) : col.type === 'boolean' ? (
        <select className="input" value={value ? 'true' : 'false'} onChange={(e) => onChange(e.target.value === 'true')}>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : col.type === 'select' ? (
        <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {col.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input className="input" type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
          value={value ?? ''} onChange={(e) => onChange(col.type === 'number' ? Number(e.target.value) : e.target.value)} />
      )}
    </div>
  );
}
