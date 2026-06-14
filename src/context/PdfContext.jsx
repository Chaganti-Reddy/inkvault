import { createContext, useContext, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadDocument, readFileBytes, isPdf } from '../lib/pdfview.js';
import i18n from '../i18n.js';

const Ctx = createContext(null);
export const usePdf = () => useContext(Ctx);

export function PdfProvider({ children }) {
  const navigate = useNavigate();
  const [bytes, setBytes] = useState(null); // canonical Uint8Array (never detached)
  const [doc, setDoc] = useState(null); // pdf.js document for rendering
  const [fileName, setFileName] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load from raw bytes. Keeps `bytes` intact and gives pdf.js its own copy, since
  // pdf.js detaches the buffer it receives.
  const openBytes = useCallback(async (data, name) => {
    setError('');
    setLoading(true);
    try {
      const canonical = data instanceof Uint8Array ? data : new Uint8Array(data);
      const d = await loadDocument(canonical.slice());
      setBytes(canonical);
      setDoc(d);
      setFileName(name || 'document.pdf');
      setNumPages(d.numPages);
      navigate('/edit');
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const openFile = useCallback(async (file) => {
    if (!isPdf(file)) { setError(i18n.t('home.errorType')); return; }
    const data = await readFileBytes(file);
    await openBytes(data, file.name);
  }, [openBytes]);

  const close = useCallback(() => {
    setBytes(null); setDoc(null); setFileName(''); setNumPages(0); setError('');
    navigate('/');
  }, [navigate]);

  const value = { bytes, doc, fileName, numPages, loading, error, setError, openFile, openBytes, close };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
