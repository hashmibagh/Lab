export function formatCurrency(value, currency = 'USD') {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function generateInvoiceNo(prefix = 'INV-') {
  const ts = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}${ts}${rand}`;
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function exportToExcel(rows, filename = 'export.xlsx') {
  import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename);
  });
}

export function exportToPdf({ title, head, body, filename = 'export.pdf' }) {
  Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([{ default: jsPDF }]) => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    doc.autoTable({ head: [head], body, startY: 22, styles: { fontSize: 8 } });
    doc.save(filename);
  });
}
