import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Minus, Trash2, ScanBarcode, Printer, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import { formatCurrency, generateInvoiceNo } from '../../lib/utils';

export default function POS() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]); // {medicine, quantity}
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    supabase.from('customers').select('id, name, phone').is('deleted_at', null).then(({ data }) => setCustomers(data ?? []));
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!query) return setResults([]);
      const { data } = await supabase.from('medicines').select('*').is('deleted_at', null)
        .or(`name.ilike.%${query}%,barcode.eq.${query},generic_name.ilike.%${query}%`).limit(8);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const addToCart = (med) => {
    if (med.current_stock <= 0) return toast.error(`${med.name} is out of stock`);
    setCart((c) => {
      const existing = c.find((i) => i.medicine.id === med.id);
      if (existing) {
        if (existing.quantity + 1 > med.current_stock) { toast.error('Not enough stock'); return c; }
        return c.map((i) => i.medicine.id === med.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...c, { medicine: med, quantity: 1 }];
    });
    setQuery('');
    setResults([]);
    searchRef.current?.focus();
  };

  const updateQty = (id, delta) => {
    setCart((c) => c.map((i) => {
      if (i.medicine.id !== id) return i;
      const q = i.quantity + delta;
      if (q > i.medicine.current_stock) { toast.error('Not enough stock'); return i; }
      return { ...i, quantity: Math.max(1, q) };
    }));
  };
  const removeItem = (id) => setCart((c) => c.filter((i) => i.medicine.id !== id));

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.medicine.sale_price * i.quantity, 0);
    const taxTotal = cart.reduce((s, i) => s + (i.medicine.sale_price * i.quantity) * (i.medicine.tax_percent / 100), 0);
    const discountTotal = subtotal * (discountPercent / 100);
    const grandTotal = subtotal + taxTotal - discountTotal;
    return { subtotal, taxTotal, discountTotal, grandTotal };
  }, [cart, discountPercent]);

  const checkout = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    setCheckingOut(true);
    const invoice_no = generateInvoiceNo();
    const paid = paidAmount === '' ? totals.grandTotal : Number(paidAmount);
    const payment_status = paid >= totals.grandTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    const { data: sale, error } = await supabase.from('sales').insert({
      invoice_no, customer_id: customerId || null,
      subtotal: totals.subtotal, tax_total: totals.taxTotal, discount_total: totals.discountTotal,
      grand_total: totals.grandTotal, paid_amount: paid, payment_method: paymentMethod,
      payment_status, created_by: profile?.id
    }).select().single();

    if (error) { setCheckingOut(false); return toast.error(error.message); }

    const items = cart.map((i) => ({
      sale_id: sale.id, medicine_id: i.medicine.id, quantity: i.quantity, unit_price: i.medicine.sale_price,
      tax_percent: i.medicine.tax_percent, discount_percent: discountPercent,
      line_total: i.medicine.sale_price * i.quantity
    }));
    const { error: itemsError } = await supabase.from('sale_items').insert(items);
    setCheckingOut(false);
    if (itemsError) return toast.error(itemsError.message);

    toast.success(`Sale ${invoice_no} completed`);
    setLastInvoice({ ...sale, items: cart, ...totals });
    setCart([]); setDiscountPercent(0); setPaidAmount(''); setCustomerId('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Search + results */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-card p-3">
          <div className="relative">
            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input ref={searchRef} className="input !pl-10 text-base" placeholder="Scan barcode or search medicine name..."
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) addToCart(results[0]); }} />
          </div>
          {results.length > 0 && (
            <div className="mt-2 divide-y divide-slate-100 dark:divide-white/5 max-h-64 overflow-y-auto">
              {results.map((m) => (
                <button key={m.id} onClick={() => addToCart(m)}
                  className="w-full flex items-center justify-between py-2 px-1 text-left hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{m.name}</p>
                    <p className="text-xs text-slate-400">Stock: {m.current_stock} · {m.barcode}</p>
                  </div>
                  <span className="text-sm font-medium text-brand-700 dark:text-brand-400">{formatCurrency(m.sale_price)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card overflow-hidden">
          {cart.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Cart is empty — search and add medicines above.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                  <th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5">Qty</th>
                  <th className="px-4 py-2.5">Price</th><th className="px-4 py-2.5">Total</th><th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {cart.map((i) => (
                  <tr key={i.medicine.id}>
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{i.medicine.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <button className="btn-ghost !p-1 rounded-md" onClick={() => updateQty(i.medicine.id, -1)}><Minus size={13}/></button>
                        <span className="w-6 text-center">{i.quantity}</span>
                        <button className="btn-ghost !p-1 rounded-md" onClick={() => updateQty(i.medicine.id, 1)}><Plus size={13}/></button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{formatCurrency(i.medicine.sale_price)}</td>
                    <td className="px-4 py-2.5 font-medium">{formatCurrency(i.medicine.sale_price * i.quantity)}</td>
                    <td className="px-4 py-2.5">
                      <button className="btn-ghost !p-1.5 rounded-lg text-red-500" onClick={() => removeItem(i.medicine.id)}><Trash2 size={14}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Checkout panel */}
      <div className="glass-card p-4 h-fit space-y-4">
        <div>
          <label className="label">Customer</label>
          <div className="flex gap-2">
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>)}
            </select>
            <button className="btn-secondary !px-2.5" onClick={() => setNewCustomerOpen(true)} aria-label="Add customer"><UserPlus size={16}/></button>
          </div>
        </div>

        <div>
          <label className="label">Discount %</label>
          <input className="input" type="number" value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} />
        </div>

        <div>
          <label className="label">Payment Method</label>
          <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option><option value="card">Card</option>
            <option value="bank">Bank Transfer</option><option value="mobile_wallet">Mobile Wallet</option>
          </select>
        </div>

        <div>
          <label className="label">Amount Paid (blank = full)</label>
          <input className="input" type="number" placeholder={totals.grandTotal.toFixed(2)} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
        </div>

        <div className="border-t border-slate-200 dark:border-white/10 pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Tax</span><span>{formatCurrency(totals.taxTotal)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Discount</span><span>-{formatCurrency(totals.discountTotal)}</span></div>
          <div className="flex justify-between text-base font-semibold text-slate-900 dark:text-white pt-1">
            <span>Total</span><span>{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>

        <button className="btn-primary w-full" onClick={checkout} disabled={checkingOut || cart.length === 0}>
          {checkingOut ? 'Processing…' : 'Complete Sale'}
        </button>
      </div>

      <ReceiptModal invoice={lastInvoice} onClose={() => setLastInvoice(null)} />
      <QuickAddCustomer open={newCustomerOpen} onClose={() => setNewCustomerOpen(false)}
        onCreated={(c) => { setCustomers((cs) => [...cs, c]); setCustomerId(c.id); }} />
    </div>
  );
}

function ReceiptModal({ invoice, onClose }) {
  if (!invoice) return null;
  return (
    <Modal open={!!invoice} onClose={onClose} title="Sale Complete"
      footer={<button className="btn-primary" onClick={() => window.print()}><Printer size={16}/> Print Receipt</button>}>
      <div id="receipt" className="text-sm space-y-2">
        <p className="font-semibold">{invoice.invoice_no}</p>
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {invoice.items.map((i) => (
            <li key={i.medicine.id} className="flex justify-between py-1">
              <span>{i.medicine.name} × {i.quantity}</span>
              <span>{formatCurrency(i.medicine.sale_price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between font-semibold border-t border-slate-200 dark:border-white/10 pt-2">
          <span>Total</span><span>{formatCurrency(invoice.grandTotal)}</span>
        </div>
      </div>
    </Modal>
  );
}

function QuickAddCustomer({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name) return toast.error('Name is required');
    setSaving(true);
    const { data, error } = await supabase.from('customers').insert({ name, phone }).select().single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Customer added');
    onCreated(data);
    setName(''); setPhone(''); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick Add Customer"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add'}</button></>}>
      <div className="space-y-3">
        <div><label className="label">Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      </div>
    </Modal>
  );
}
