import { useRef, useState } from 'react';
import { Upload, X, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile } from '../../lib/storage';

/**
 * kind: 'image' shows a thumbnail preview; 'file' shows a filename chip (for PDFs etc.)
 */
export default function FileUpload({ bucket, folder = '', value, onChange, kind = 'image', accept, label }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { url } = await uploadFile(bucket, file, folder);
      onChange(url);
      toast.success('File uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input ref={inputRef} type="file" accept={accept ?? (kind === 'image' ? 'image/*' : 'image/*,.pdf')}
        className="hidden" onChange={handleFile} />

      {value ? (
        <div className="flex items-center gap-3">
          {kind === 'image' ? (
            <img src={value} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-white/10" />
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/10 text-sm text-slate-600 dark:text-slate-300">
              <FileText size={16} /> File attached
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary !py-1.5" onClick={() => inputRef.current?.click()} disabled={loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Replace
            </button>
            <button type="button" className="btn-ghost !p-2 rounded-lg text-red-500" onClick={() => onChange('')} aria-label="Remove file">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-white/15 py-4 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {loading ? 'Uploading…' : 'Click to upload'}
        </button>
      )}
    </div>
  );
}
