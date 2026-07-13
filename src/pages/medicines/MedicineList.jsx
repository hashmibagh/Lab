import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Download, FileSpreadsheet, Barcode, QrCode, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import { ConfirmDialog, EmptyState, TableSkeleton } from '../../components/ui/Feedback';
import FileUpload from '../../components/ui/FileUpload';
import { formatCurrency, formatDate, daysUntil, exportToExcel, classNames } from '../../lib/utils';

const EMPTY = {
  name: '', generic_name: '', brand_name: '', manufacturer_id: '', category_id: '',
  batch_number: '', barcode: '', strength: '', dosage_form: '', packing: '',
  purchase_price: 0, sale_price: 0, wholesale_price: 0, tax_percent: 0, discount_percent: 0,
  current_stock: 0, minimum_stock: 10, maximum_stock: 1000, expiry_date: '', manufacturing_date: '',
  supplier_id: '', rack_number: '', description: '', image_url: ''
};

export default function MedicineList() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [labelTarget, setLabelTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const canWrite = hasRole('manager');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [m, c, mf, s] = await Promise.all([
      supabase.from('medicines').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('medicine_categories').select('id, name'),
      supabase.from('manufacturers').select('id, name'),
      supabase.from('suppliers').select('id, name')
    ]);
    if (m.error) toast.error(m.error.message);
    setRows(m.data ?? []);
    setCategories(c.data ?? []);
    setManufacturers(mf.data ?? []);
    setSuppliers(s.data ?? []);
    setLoading(false);
  }

  const catName = (id) => categories.find((c) => c.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    let list = rows;
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((r) => [r.name, r.generic_name, r.brand_name, r.barcode].some((v) => String(v ?? '').toLowerCase().includes(q)));
    }
    if (stockFilter === 'low') list = list.filter((r) => r.current_stock > 0 && r.current_stock <= r.minimum_stock);
    if (stockFilter === 'out') list = list.filter((r) => r.current_stock <= 0);
    if (stockFilter === 'expiring') list = list.filter((r) => r.expiry_date && daysUntil(r.expiry_date) <= 30 && daysUntil(r.expiry_date) >= 0);
    if (stockFilter === 'expired') list = list.filter((r) => r.expiry_date && daysUntil(r.expiry_date) < 0);
    return list;
  }, [rows, query, stockFilter]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ ...EMPTY, ...row }); setModalOpen(true); };

  const save = async () => {
    setSaving(true);
    const payload = { ...form };
    ['id', 'created_at', 'updated_at', 'deleted_at'].forEach((k) => delete payload[k]);
    ['manufacturer_id', 'category_id', 'supplier_id'].forEach((k) => { if (!payload[k]) payload[k] = null; });
    ['expiry_date', 'manufacturing_date'].forEach((k) => { if (!payload[k]) payload[k] = null; });
    if (!payload.barcode) payload.barcode = `MED${Date.now()}`;

    let error;
    if (editing) ({ error } = await supabase.from('medicines').update(payload).eq('id', editing.id));
    else ({ error } = await supabase.from('medicines').insert(payload));

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? 'Medicine updated' : 'Medicine added');
    setModalOpen(false);
    load();
  };

  const remove = async () => {
    if (!confirmTarget) return;
    const { error } = await supabase.from('medicines').update({ deleted_at: new Date().toISOString() }).eq('id', confirmTarget.id);
    if (error) return toast.error(error.message);
    toast.success('Medicine removed');
    setConfirmTarget(null);
    load();
  };

  const duplicate = async (row) => {
    const payload = { ...row };
    ['id', 'created_at', 'updated_at', 'deleted_at'].forEach((k) => delete payload[k]);
    payload.name = `${payload.name} (Copy)`;
    payload.barcode = `MED${Date.now()}`;
    const { error } = await supabase.from('medicines').insert(payload);
    if (error) return toast.error(error.message);
    toast.success('Medicine duplicated');
    load();
  };

  const doExportExcel = () => exportToExcel(filtered.map((r) => ({
    Name: r.name, Generic: r.generic_name, Brand: r.brand_name, Category: catName(r.category_id),
    Batch: r.batch_number, Barcode: r.barcode, Stock: r.current_stock, MinStock: r.minimum_stock,
    SalePrice: r.sale_price, PurchasePrice: r.purchase_price, Expiry: r.expiry_date
  })), 'medicines.xlsx');

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
    const payload = json.map((r) => ({
      name: r.Name ?? r.name, generic_name: r.Generic ?? r.generic_name, brand_name: r.Brand ?? r.brand_name,
      batch_number: r.Batch ?? r.batch_number, barcode: r.Barcode ?? `MED${Date.now()}${Math.random()}`,
      current_stock: Number(r.Stock ?? 0), sale_price: Number(r.SalePrice ?? 0), purchase_price: Number(r.PurchasePrice ?? 0)
    })).filter((r) => r.name);
    if (payload.length === 0) return toast.error('No valid rows found in file');
    const { error } = await supabase.from('medicines').insert(payload);
    if (error) return toast.error(error.message);
    toast.success(`Imported ${payload.length} medicines`);
    load();
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-display font-semibold text-slate-900 dark:text-white">Medicines</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} of {rows.length} medicines</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="btn-secondary cursor-pointer">
            <Upload size={16}/> Import
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
          </label>
          <button className="btn-secondary" onClick={doExportExcel}><FileSpreadsheet size={16}/> Export</button>
          {canWrite && <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Add Medicine</button>}
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-white/10 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input className="input !pl-9" placeholder="Search by name, generic, brand, barcode..."
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="input !w-auto" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="all">All stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="expiring">Expiring in 30 days</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {loading ? <TableSkeleton cols={7} /> : filtered.length === 0 ? (
          <EmptyState title="No medicines found" description="Try adjusting filters or add a new medicine."
            action={canWrite && <button className="btn-primary" onClick={openCreate}><Plus size={16}/> Add Medicine</button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-2.5">Medicine</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Stock</th>
                  <th className="px-4 py-2.5">Sale Price</th>
                  <th className="px-4 py-2.5">Expiry</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filtered.map((r) => {
                  const dLeft = daysUntil(r.expiry_date);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {r.image_url ? (
                            <img src={r.image_url} alt="" className="w-8 h-8 rounded-md object-cover border border-slate-200 dark:border-white/10 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-white/10 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">{r.name}</p>
                            <p className="text-xs text-slate-400">{r.generic_name || r.brand_name || r.batch_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{catName(r.category_id)}</td>
                      <td className="px-4 py-2.5">
                        <span className={classNames('badge',
                          r.current_stock <= 0 ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                          : r.current_stock <= r.minimum_stock ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300')}>
                          {r.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{formatCurrency(r.sale_price)}</td>
                      <td className="px-4 py-2.5">
                        <span className={dLeft !== null && dLeft < 0 ? 'text-red-500' : dLeft !== null && dLeft <= 30 ? 'text-amber-500' : 'text-slate-500'}>
                          {formatDate(r.expiry_date)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button className="btn-ghost !p-1.5 rounded-lg" onClick={() => setLabelTarget(r)} aria-label="Print labels">
                            <Barcode size={15} />
                          </button>
                          {canWrite && (
                            <>
                              <button className="btn-ghost !p-1.5 rounded-lg" onClick={() => duplicate(r)} aria-label="Duplicate">
                                <Download size={15} className="rotate-180" />
                              </button>
                              <button className="btn-ghost !p-1.5 rounded-lg" onClick={() => openEdit(r)} aria-label="Edit">
                                <Pencil size={15} />
                              </button>
                              <button className="btn-ghost !p-1.5 rounded-lg text-red-500" onClick={() => setConfirmTarget(r)} aria-label="Delete">
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} width="max-w-2xl"
        title={editing ? 'Edit Medicine' : 'Add Medicine'}
        footer={<>
          <button className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <FileUpload bucket="medicine-images" kind="image" label="Photo"
              value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          </div>
          <Text label="Name *" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Text label="Generic Name" value={form.generic_name} onChange={(v) => setForm((f) => ({ ...f, generic_name: v }))} />
          <Text label="Brand Name" value={form.brand_name} onChange={(v) => setForm((f) => ({ ...f, brand_name: v }))} />
          <Select label="Manufacturer" value={form.manufacturer_id} onChange={(v) => setForm((f) => ({ ...f, manufacturer_id: v }))}
            options={manufacturers.map((m) => ({ value: m.id, label: m.name }))} />
          <Select label="Category" value={form.category_id} onChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
            options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <Select label="Supplier" value={form.supplier_id} onChange={(v) => setForm((f) => ({ ...f, supplier_id: v }))}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          <Text label="Batch Number" value={form.batch_number} onChange={(v) => setForm((f) => ({ ...f, batch_number: v }))} />
          <Text label="Barcode (auto if blank)" value={form.barcode} onChange={(v) => setForm((f) => ({ ...f, barcode: v }))} />
          <Text label="Strength" value={form.strength} onChange={(v) => setForm((f) => ({ ...f, strength: v }))} />
          <Text label="Dosage Form" value={form.dosage_form} onChange={(v) => setForm((f) => ({ ...f, dosage_form: v }))} />
          <Text label="Packing" value={form.packing} onChange={(v) => setForm((f) => ({ ...f, packing: v }))} />
          <Text label="Rack Number" value={form.rack_number} onChange={(v) => setForm((f) => ({ ...f, rack_number: v }))} />
          <Num label="Purchase Price" value={form.purchase_price} onChange={(v) => setForm((f) => ({ ...f, purchase_price: v }))} />
          <Num label="Sale Price" value={form.sale_price} onChange={(v) => setForm((f) => ({ ...f, sale_price: v }))} />
          <Num label="Wholesale Price" value={form.wholesale_price} onChange={(v) => setForm((f) => ({ ...f, wholesale_price: v }))} />
          <Num label="Tax %" value={form.tax_percent} onChange={(v) => setForm((f) => ({ ...f, tax_percent: v }))} />
          <Num label="Discount %" value={form.discount_percent} onChange={(v) => setForm((f) => ({ ...f, discount_percent: v }))} />
          <Num label="Current Stock" value={form.current_stock} onChange={(v) => setForm((f) => ({ ...f, current_stock: v }))} />
          <Num label="Minimum Stock" value={form.minimum_stock} onChange={(v) => setForm((f) => ({ ...f, minimum_stock: v }))} />
          <Num label="Maximum Stock" value={form.maximum_stock} onChange={(v) => setForm((f) => ({ ...f, maximum_stock: v }))} />
          <Text label="Expiry Date" type="date" value={form.expiry_date} onChange={(v) => setForm((f) => ({ ...f, expiry_date: v }))} />
          <Text label="Manufacturing Date" type="date" value={form.manufacturing_date} onChange={(v) => setForm((f) => ({ ...f, manufacturing_date: v }))} />
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <LabelModal medicine={labelTarget} onClose={() => setLabelTarget(null)} />

      <ConfirmDialog open={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={remove}
        title="Remove medicine?" description={`"${confirmTarget?.name}" will be archived and hidden from active lists.`} />
    </div>
  );
}

function Text({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Num({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type="number" step="0.01" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function LabelModal({ medicine, onClose }) {
  const barcodeRef = useRef(null);
  const qrRef = useRef(null);

  useEffect(() => {
    if (!medicine) return;
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (barcodeRef.current) JsBarcode(barcodeRef.current, medicine.barcode || medicine.id, { height: 50, fontSize: 12 });
    });
    import('qrcode').then((QRCode) => {
      if (qrRef.current) QRCode.toCanvas(qrRef.current, medicine.qr_code || medicine.id, { width: 140 });
    });
  }, [medicine]);

  if (!medicine) return null;

  const print = () => window.print();

  return (
    <Modal open={!!medicine} onClose={onClose} title={`Labels — ${medicine.name}`}
      footer={<button className="btn-primary" onClick={print}><Download size={16}/> Print</button>}>
      <div className="flex flex-col items-center gap-6 py-2">
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 justify-center"><Barcode size={14}/> Barcode</p>
          <svg ref={barcodeRef} />
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 justify-center"><QrCode size={14}/> QR Code</p>
          <canvas ref={qrRef} />
        </div>
      </div>
    </Modal>
  );
}
